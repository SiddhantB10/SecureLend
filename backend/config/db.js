const mongoose = require('mongoose');
const { Resolver } = require('dns').promises;
const { MongoMemoryServer } = require('mongodb-memory-server');
const ensureIndexes = require('../database/ensureIndexes');

let memoryServer = null;

const isSrvDnsError = (errorMessage = '') => {
  const normalized = String(errorMessage).toLowerCase();
  return (
    normalized.includes('querysrv')
    || normalized.includes('enixio')
    || normalized.includes('enotfound')
    || normalized.includes('eai_again')
  );
};

const buildConnectOptions = () => ({
  serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 15000),
  connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 15000),
  socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000),
  retryWrites: true,
  family: 4,
});

const connectWithUri = async (uri, options) => {
  await mongoose.connect(uri, options);
  await ensureIndexes();
  return true;
};

const mergeSearchParams = (targetParams, sourceParams) => {
  sourceParams.forEach((value, key) => {
    if (!targetParams.has(key)) {
      targetParams.set(key, value);
    }
  });
};

const buildStandardUriFromSrv = async (srvUri) => {
  if (!String(srvUri || '').startsWith('mongodb+srv://')) {
    return null;
  }

  const parsed = new URL(srvUri);
  const clusterHost = parsed.hostname;
  if (!clusterHost) {
    return null;
  }

  const resolver = new Resolver();
  const configuredServers = String(process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (configuredServers.length) {
    resolver.setServers(configuredServers);
  }

  const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${clusterHost}`);
  if (!srvRecords.length) {
    return null;
  }

  const txtRecords = await resolver.resolveTxt(clusterHost).catch(() => []);

  const query = new URLSearchParams(parsed.search);
  const txtParams = new URLSearchParams();
  txtRecords.flat().forEach((entry) => {
    const params = new URLSearchParams(String(entry || ''));
    mergeSearchParams(txtParams, params);
  });
  mergeSearchParams(query, txtParams);

  if (!query.has('tls')) {
    query.set('tls', 'true');
  }

  const hostList = srvRecords
    .map((record) => `${record.name}:${record.port}`)
    .join(',');
  const dbPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/securelend';

  const username = parsed.username ? encodeURIComponent(decodeURIComponent(parsed.username)) : '';
  const password = parsed.password ? encodeURIComponent(decodeURIComponent(parsed.password)) : '';
  const credentials = username
    ? `${username}:${password}@`
    : '';

  return `mongodb://${credentials}${hostList}${dbPath}?${query.toString()}`;
};

const connectDatabase = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  const options = buildConnectOptions();

  try {
    await connectWithUri(process.env.MONGODB_URI, options);
    console.log('MongoDB connected');
    return true;
  } catch (error) {
    console.warn('MongoDB Atlas connection failed:', error.message);

    const fallbackUri = process.env.MONGODB_URI_FALLBACK;
    if (fallbackUri && isSrvDnsError(error.message)) {
      try {
        console.warn('Retrying MongoDB connection via MONGODB_URI_FALLBACK');
        await connectWithUri(fallbackUri, options);
        console.log('MongoDB connected using fallback URI');
        return true;
      } catch (fallbackUriError) {
        console.warn('MongoDB fallback URI connection failed:', fallbackUriError.message);
      }
    }

    if (isSrvDnsError(error.message)) {
      try {
        const generatedFallbackUri = await buildStandardUriFromSrv(process.env.MONGODB_URI);
        if (generatedFallbackUri) {
          console.warn('Retrying MongoDB connection via generated non-SRV URI');
          await connectWithUri(generatedFallbackUri, options);
          console.log('MongoDB connected using generated non-SRV URI');
          return true;
        }
      } catch (generatedFallbackError) {
        console.warn('Generated non-SRV MongoDB URI failed:', generatedFallbackError.message);
      }
    }

    // If the caller explicitly requests no in-memory fallback, rethrow so
    // seeding or critical operations don't accidentally write to ephemeral DB.
    if (process.env.DISABLE_DB_FALLBACK === 'true') {
      throw new Error(
        `Failed to connect to configured MongoDB and in-memory fallback is disabled: ${error.message}. `
        + 'If your network blocks DNS SRV lookups, set MONGODB_URI_FALLBACK to a mongodb:// URI.'
      );
    }

    console.warn('Starting local in-memory fallback MongoDB');

    try {
      if (!memoryServer) {
        memoryServer = await MongoMemoryServer.create({
          instance: {
            dbName: 'securelend',
          },
        });
      }

      const fallbackUri = memoryServer.getUri();
      await mongoose.connect(fallbackUri);
      console.log('MongoDB fallback connected');
      return true;
    } catch (fallbackError) {
      console.warn('MongoDB fallback failed:', fallbackError.message);
      return false;
    }
  }
};

module.exports = connectDatabase;
