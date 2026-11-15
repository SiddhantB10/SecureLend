const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const loanRoutes = require('./routes/loanRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

const parseAllowedOrigins = () => {
  const allowedOriginsRaw = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '';
  return allowedOriginsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

// In development, allow the local frontend dev server so CORS won't block local testing.
if (process.env.NODE_ENV !== 'production') {
  const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
  devOrigins.forEach((o) => {
    if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
  });
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({
    message: 'SecureLend backend is running',
    health: '/health',
  });
});

app.get('/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    service: 'securelend-backend',
    database: dbStates[mongoose.connection.readyState] || 'unknown',
  });
});

app.use(authRoutes);
app.use(loanRoutes);
app.use(adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Central error handler: always answer JSON (malformed JSON bodies, CORS rejections, etc.)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }
  if (String(err.message || '').startsWith('CORS blocked')) {
    return res.status(403).json({ message: err.message });
  }
  console.error('Unhandled error:', err);
  return res.status(err.status || 500).json({ message: 'Internal server error' });
});

module.exports = app;
