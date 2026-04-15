const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const validateRequest = require('../middleware/validationResult');

const router = express.Router();
const indianPhoneRegex = /^(?:\+91[-\s]?)?[6-9]\d{9}$/;

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
  ],
  validateRequest,
  authController.signup
);

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
