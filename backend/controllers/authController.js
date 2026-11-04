const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AdminAccount = require('../database/models/admin/AdminAccount');
const OtpSession = require('../database/models/users/OtpSession');
const { generateOtp, sendEmailOtp, sendSmsOtp } = require('../services/otpService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  if (!error) return { status: 500, message: 'Failed to create account' };

  if (error.code === 11000) {
    return { status: 409, message: 'An account with this email already exists' };
  }

  if (error.name === 'ValidationError') {
    const firstFieldError = Object.values(error.errors || {})[0];
    return { status: 400, message: firstFieldError?.message || 'Invalid signup details' };
  }

  if (error.name === 'MongoServerSelectionError') {
    return { status: 503, message: 'Database connection failed. Please try again in a moment.' };
  }

  return { status: 500, message: error.message || 'Failed to create account' };
};

// ─── OTP: Send ───────────────────────────────────────────────────────────────

exports.sendOtp = async (req, res) => {
  try {
    const { email, phone } = req.body;

    // Block if email already registered
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Rate-limit: allow resend only after 60 seconds
    const existing = await OtpSession.findOne({ email: email.toLowerCase() });
    if (existing) {
      const secondsSinceCreated = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
      if (secondsSinceCreated < 60) {
        return res.status(429).json({
          message: `Please wait ${Math.ceil(60 - secondsSinceCreated)} seconds before requesting a new OTP`,
        });
      }
      await OtpSession.deleteOne({ _id: existing._id });
    }

    const emailOtp = generateOtp();
    const phoneOtp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await OtpSession.create({ email: email.toLowerCase(), phone, emailOtp, phoneOtp, expiresAt });

    // Send both OTPs in parallel — if SMS fails, still send email and warn
    const results = await Promise.allSettled([
      sendEmailOtp(email, emailOtp),
      sendSmsOtp(phone, phoneOtp),
    ]);

    const smsFailed = results[1].status === 'rejected';

    return res.json({
      message: smsFailed
        ? 'Email OTP sent. SMS delivery failed — please check your phone number or retry.'
        : 'OTP sent to your email and phone number',
      smsFailed,
    });
  } catch (error) {
    console.error('sendOtp error:', error);
    return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
};

// ─── OTP: Verify ─────────────────────────────────────────────────────────────

exports.verifyOtp = async (req, res) => {
  try {
    const { email, emailOtp, phoneOtp } = req.body;

    const session = await OtpSession.findOne({ email: email.toLowerCase() });

    if (!session) {
      return res.status(400).json({ message: 'No OTP session found. Please request a new OTP.' });
    }

    if (new Date() > session.expiresAt) {
      await OtpSession.deleteOne({ _id: session._id });
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Allow max 5 attempts
    if (session.attempts >= 5) {
      await OtpSession.deleteOne({ _id: session._id });
      return res.status(400).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    const emailMatch = session.emailOtp === emailOtp.trim();
    const phoneMatch = session.phoneOtp === phoneOtp.trim();

    if (!emailMatch || !phoneMatch) {
      await OtpSession.updateOne({ _id: session._id }, { $inc: { attempts: 1 } });
      const errors = [];
      if (!emailMatch) errors.push('emailOtp');
      if (!phoneMatch) errors.push('phoneOtp');
      return res.status(400).json({ message: 'Incorrect OTP(s)', invalidFields: errors });
    }

    // Both OTPs correct — issue a short-lived verified token (15 min)
    const verifiedToken = crypto.randomBytes(32).toString('hex');
    await OtpSession.updateOne(
      { _id: session._id },
      { emailVerified: true, phoneVerified: true, verifiedToken, expiresAt: new Date(Date.now() + 15 * 60 * 1000) }
    );

    return res.json({ message: 'Both OTPs verified successfully', verifiedToken });
  } catch (error) {
    console.error('verifyOtp error:', error);
    return res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
};

// ─── Signup (requires verifiedToken) ─────────────────────────────────────────

exports.signup = async (req, res) => {
  try {
    const { name, email, password, phone, verifiedToken } = req.body;

    // Check verifiedToken from OTP session
    const session = await OtpSession.findOne({
      email: email.toLowerCase(),
      verifiedToken,
      emailVerified: true,
      phoneVerified: true,
    });

    if (!session) {
      return res.status(403).json({
        message: 'Email and phone not verified. Please complete OTP verification first.',
      });
    }

    if (new Date() > session.expiresAt) {
      await OtpSession.deleteOne({ _id: session._id });
      return res.status(403).json({ message: 'Verification session expired. Please verify again.' });
    }

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
      emailVerified: true,
      phoneVerified: true,
    });

    // Clean up the OTP session
    await OtpSession.deleteOne({ _id: session._id });

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

// ─── Login ────────────────────────────────────────────────────────────────────

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = email.toLowerCase();
    const admin = await AdminAccount.findOne({ email: normalizedEmail });
    const user = admin ? null : await User.findOne({ email: normalizedEmail });
    const account = admin || user;

    if (!account) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, account.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = buildToken(account);

    return res.json({
      message: 'Login successful',
      token,
      user: sanitizeUser(account),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to log in', error: error.message });
  }
};
