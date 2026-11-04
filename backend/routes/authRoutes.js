const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const validateRequest = require('../middleware/validationResult');

const router = express.Router();
const indianPhoneRegex = /^(?:\+91[-\s]?)?[6-9]\d{9}$/;

// ─── Send OTP (Step 1 of signup) ─────────────────────────────────────────────
router.post(
  '/auth/send-otp',
  [
    body('email').isEmail().withMessage('Enter a valid email address'),
    body('phone')
      .trim()
      .matches(indianPhoneRegex)
      .withMessage('Enter a valid Indian phone number (10 digits, optionally prefixed with +91)'),
  ],
  validateRequest,
  authController.sendOtp
);

// ─── Verify OTP (Step 2 of signup) ───────────────────────────────────────────
router.post(
  '/auth/verify-otp',
  [
    body('email').isEmail().withMessage('Enter a valid email address'),
    body('emailOtp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Enter a valid 6-digit email OTP'),
    body('phoneOtp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Enter a valid 6-digit phone OTP'),
  ],
  validateRequest,
  authController.verifyOtp
);

// ─── Signup (Step 3 — requires verifiedToken from step 2) ────────────────────
router.post(
  '/signup',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
    body('email').isEmail().withMessage('Enter a valid email address'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('phone')
      .trim()
      .matches(indianPhoneRegex)
      .withMessage('Enter a valid Indian phone number (10 digits, optionally prefixed with +91)'),
    body('verifiedToken').notEmpty().withMessage('OTP verification is required before signup'),
  ],
  validateRequest,
  authController.signup
);

// ─── Login ────────────────────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Enter a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  authController.login
);

module.exports = router;
