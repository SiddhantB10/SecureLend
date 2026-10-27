const mongoose = require('mongoose');
const ensureIndexes = require('../database/ensureIndexes');

const buildConnectOptions = () => ({
  dbName: 'securelend',
  serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 15000),
  connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 15000),
  socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000),
  retryWrites: true,
  family: 4,
});

const connectDatabase = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  const options = buildConnectOptions();

  await mongoose.connect(process.env.MONGODB_URI, options);
  await ensureIndexes();
  console.log('MongoDB connected');
  return true;
};

module.exports = connectDatabase;
