require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const app = require('./app');
const connectDatabase = require('./config/db');

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

const startServer = async () => {
  try {
    await connectDatabase();
    await startHttpServer();
  } catch (error) {
    console.error('Failed to start server:', error.message);
    try {
      await startHttpServer();
      console.log('Server is running without database connection');
    } catch (listenError) {
      console.error('Failed to start HTTP server:', listenError.message);
      process.exit(1);
    }
  }
};

startServer();
