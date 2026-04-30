const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let memoryServer = null;

const connectDatabase = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('MongoDB connected');
    return true;
  } catch (error) {
    console.warn('MongoDB Atlas connection failed:', error.message);

    // If the caller explicitly requests no in-memory fallback, rethrow so
    // seeding or critical operations don't accidentally write to ephemeral DB.
    if (process.env.DISABLE_DB_FALLBACK === 'true') {
      throw new Error(
        `Failed to connect to configured MongoDB and in-memory fallback is disabled: ${error.message}`
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
