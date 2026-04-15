const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const buildToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
});

const mapSignupError = (error) => {
  if (!error) {
    return { status: 500, message: 'Failed to create account' };
  }

  if (error.code === 11000) {
    return { status: 409, message: 'An account with this email already exists' };
  }

  if (error.name === 'ValidationError') {
    const firstFieldError = Object.values(error.errors || {})[0];
    return {
      status: 400,
      message: firstFieldError?.message || 'Invalid signup details',
    };
  }

  if (error.name === 'MongoServerSelectionError') {
    return {
      status: 503,
      message: 'Database connection failed. Please try again in a moment.',
    };
  }

  return { status: 500, message: error.message || 'Failed to create account' };
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role: 'user',
    });

    const token = buildToken(user);

    return res.status(201).json({
      message: 'Signup successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    const mapped = mapSignupError(error);
    return res.status(mapped.status).json({ message: mapped.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = buildToken(user);

    return res.json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to log in', error: error.message });
  }
};
