const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AdminAccount = require('../database/models/admin/AdminAccount');
const OtpSession = require('../database/models/users/OtpSession');
const { logAdminAction } = require('../services/auditLogService');
const { generateOtp, normalisePhone, sendEmailOtp, sendSmsOtp, OTP_TTL_MINUTES } = require('../services/otpService');

const isProduction = () => process.env.NODE_ENV === 'production';

/** Constant-time string comparison for OTP codes */
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

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

  if (error.name === 'MongoServerSelectionError' || error.name === 'MongooseServerSelectionError') {
    return { status: 503, message: 'Database connection failed. Please try again in a moment.' };
  }

  return { status: 500, message: error.message || 'Failed to create account' };
};

// ─── OTP: Send ───────────────────────────────────────────────────────────────

exports.sendOtp = async (req, res) => {
  try {
    const { email, phone } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // Block if email already registered (as a user or an admin)
    const [existingUser, existingAdmin] = await Promise.all([
      User.findOne({ email: normalizedEmail }),
      AdminAccount.findOne({ email: normalizedEmail }),
    ]);
    if (existingUser || existingAdmin) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Rate-limit: allow resend only after 60 seconds
    const existing = await OtpSession.findOne({ email: normalizedEmail });
    if (existing) {
      const secondsSinceCreated = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
      if (secondsSinceCreated < 60) {
        return res.status(429).json({
          message: `Please wait ${Math.ceil(60 - secondsSinceCreated)} seconds before requesting a new OTP`,
        });
      }
      await OtpSession.deleteMany({ email: normalizedEmail });
    }

    const emailOtp = generateOtp();
    const phoneOtp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Save session BEFORE sending so we have the OTPs stored
    const session = await OtpSession.create({ email: normalizedEmail, phone, emailOtp, phoneOtp, expiresAt });

    // Send both OTPs in parallel
    const results = await Promise.allSettled([
      sendEmailOtp(normalizedEmail, emailOtp),
      sendSmsOtp(phone, phoneOtp),
    ]);

    const emailFailed = results[0].status === 'rejected';
    const smsFailed   = results[1].status === 'rejected';

    if (!isProduction()) {
      // Local development aid: OTPs are printed only when NODE_ENV is not production.
      console.log(`[DEV OTP] ${normalizedEmail} -> email OTP ${emailOtp}, phone OTP ${phoneOtp}`);
    }

    // If EMAIL failed, delete the session so user can retry immediately (not rate-limited)
    if (emailFailed) {
      console.error('Email OTP send error:', results[0].reason?.message || results[0].reason);
      if (isProduction()) {
        await OtpSession.deleteOne({ _id: session._id });
        return res.status(502).json({
          message: 'We could not send the email OTP right now. Please try again in a minute.',
        });
      }
    }

    // If SMS failed, mark it in session so verify step skips phone OTP check
    if (smsFailed) {
      console.error('SMS OTP send error:', results[1].reason?.message || results[1].reason);
      await OtpSession.updateOne({ _id: session._id }, { smsSent: false });
    }

    return res.json({
      message: emailFailed
        ? 'Email delivery failed (development mode): the OTP is printed in the backend console.'
        : smsFailed
          ? 'Email OTP sent. SMS delivery failed — verify with email OTP only.'
          : 'OTP sent to your email and phone number',
      smsFailed,
      emailFailed,
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

    const session = await OtpSession.findOne({ email: email.toLowerCase().trim() }).sort({ createdAt: -1 });

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

    const emailMatch = safeEqual(session.emailOtp, String(emailOtp).trim());
    // If SMS was never sent, skip phone OTP check (treat phone as auto-verified)
    const phoneMatch = session.smsSent === false ? true : safeEqual(session.phoneOtp, String(phoneOtp || '').trim());

    if (!emailMatch || !phoneMatch) {
      await OtpSession.updateOne({ _id: session._id }, { $inc: { attempts: 1 } });
      const errors = [];
      if (!emailMatch) errors.push('emailOtp');
      if (!phoneMatch) errors.push('phoneOtp');
      return res.status(400).json({ message: 'Incorrect OTP(s)', invalidFields: errors });
    }

    // OTPs verified — issue a short-lived verified token (15 min)
    const verifiedToken = crypto.randomBytes(32).toString('hex');
    await OtpSession.updateOne(
      { _id: session._id },
      {
        emailVerified: true,
        phoneVerified: session.smsSent !== false,
        verifiedToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }
    );

    return res.json({
      message: session.smsSent === false
        ? 'Email OTP verified (phone OTP skipped — SMS not delivered)'
        : 'Both OTPs verified successfully',
      verifiedToken,
      smsSent: session.smsSent !== false,
    });
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
    const normalizedEmail = email.toLowerCase().trim();
    const session = await OtpSession.findOne({
      email: normalizedEmail,
      verifiedToken,
      emailVerified: true,
    });

    if (!session || (session.smsSent !== false && !session.phoneVerified)) {
      return res.status(403).json({
        message: 'Email and phone not verified. Please complete OTP verification first.',
      });
    }

    if (new Date() > session.expiresAt) {
      await OtpSession.deleteOne({ _id: session._id });
      return res.status(403).json({ message: 'Verification session expired. Please verify again.' });
    }

    // The phone number must be the one the OTP was sent to.
    if (normalisePhone(session.phone) !== normalisePhone(phone)) {
      return res.status(400).json({ message: 'Phone number does not match the verified number. Please verify again.' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
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
      phoneVerified: session.smsSent !== false,
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

    const normalizedEmail = email.toLowerCase().trim();
    const admin = await AdminAccount.findOne({ email: normalizedEmail, active: { $ne: false } });
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

    if (admin) {
      await logAdminAction({ adminId: admin._id, action: 'ADMIN_LOGIN', entityType: 'session', entityId: admin._id, metadata: { ip: req.ip } });
    }

    return res.json({
      message: 'Login successful',
      token,
      user: sanitizeUser(account),
    });
  } catch (error) {
    console.error('login error:', error);
    if (error.name === 'MongoServerSelectionError' || error.name === 'MongooseServerSelectionError') {
      return res.status(503).json({ message: 'Database connection failed. Please try again in a moment.' });
    }
    return res.status(500).json({ message: 'Failed to log in' });
  }
};
