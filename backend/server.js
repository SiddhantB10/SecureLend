require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const app = require('./app');
const connectDatabase = require('./config/db');
const { startMlKeepWarm } = require('./services/mlService');

const PORT = process.env.PORT || 5000;

const listenOnPort = (port) =>
  new Promise((resolve, reject) => {
    const server = app
      .listen(port, () => resolve({ server, port }))
      .on('error', reject);
  });

const startHttpServer = async () => {
  const preferredPort = Number(PORT);
  try {
    const { port } = await listenOnPort(preferredPort);
    console.log(`SecureLend backend running on port ${port}`);
    return;
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      const fallbackPort = preferredPort + 1;
      const { port } = await listenOnPort(fallbackPort);
      console.warn(`Port ${preferredPort} is busy. SecureLend backend is running on port ${port}`);
      return;
    }

    throw error;
  }
};

const DB_RETRY_MS = Number(process.env.MONGODB_RETRY_MS || 10000);

// Keep retrying the database in the background so a transient Atlas/network
// failure at boot does not leave the API permanently without a database.
const connectWithRetry = async () => {
  try {
    await connectDatabase();
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}. Retrying in ${DB_RETRY_MS / 1000}s...`);
    setTimeout(connectWithRetry, DB_RETRY_MS);
  }
};

const startServer = async () => {
  try {
    await startHttpServer();
  } catch (listenError) {
    console.error('Failed to start HTTP server:', listenError.message);
    process.exit(1);
  }
  connectWithRetry();
  startMlKeepWarm();
};

startServer();
