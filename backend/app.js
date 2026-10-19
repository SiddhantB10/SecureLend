const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
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
  res.json({ status: 'ok', service: 'securelend-backend' });
});

app.use(authRoutes);
app.use(loanRoutes);
app.use(adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

module.exports = app;
