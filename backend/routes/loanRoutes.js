const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const validateRequest = require('../middleware/validationResult');
const loanController = require('../controllers/loanController');

const router = express.Router();

const loanValidation = [
  body('income').isFloat({ gt: 0 }).withMessage('Income must be greater than 0'),
  body('creditScore').isInt({ min: 300, max: 850 }).withMessage('Credit score must be between 300 and 850'),
  body('loanAmount').isFloat({ gt: 0 }).withMessage('Loan amount must be greater than 0'),
  body('employment').notEmpty().withMessage('Employment status is required'),
];

router.post('/apply-loan', authMiddleware, loanValidation, validateRequest, loanController.applyLoan);
router.get('/my-loans', authMiddleware, loanController.getMyLoans);
router.get('/all-loans', authMiddleware, adminOnly, loanController.getAllLoans);
router.get('/loan/:id', authMiddleware, loanController.getLoanById);
router.put(
  '/loan/:id/status',
  authMiddleware,
  adminOnly,
  [body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected')],
  validateRequest,
  loanController.updateLoanStatus
);

module.exports = router;
