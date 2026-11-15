const mongoose = require('mongoose');

const otpSessionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    emailOtp: {
      type: String,
      required: true,
    },
    phoneOtp: {
      type: String,
      required: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    // After both OTPs verified, we issue a short-lived verifiedToken
    verifiedToken: {
      type: String,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    // If SMS couldn't be delivered, phone OTP check is skipped on verify
    smsSent: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'otp_sessions',
  }
);

// Auto-delete expired sessions
otpSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// One session per email at a time
otpSessionSchema.index({ email: 1 });

module.exports = mongoose.models.OtpSession || mongoose.model('OtpSession', otpSessionSchema);

