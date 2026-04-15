const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const validateRequest = require('../middleware/validationResult');
const loanController = require('../controllers/loanController');

const router = express.Router();

const loanValidation = [
  body('loanType').isIn(['personal', 'property']).withMessage('Loan type must be personal or property'),
  body('income').isFloat({ gt: 0 }).withMessage('Income in INR must be greater than 0'),
  body('creditScore').isInt({ min: 300, max: 900 }).withMessage('Credit score must be between 300 and 900'),
  body('loanAmount').isFloat({ gt: 0 }).withMessage('Loan amount in INR must be greater than 0'),
  body('existingDebt').isFloat({ min: 0 }).withMessage('Existing debt in INR must be 0 or greater'),
  body('employmentStatus')
    .if(body('loanType').equals('personal'))
    .isIn(['stable', 'moderate', 'unstable'])
    .withMessage('Employment status must be stable, moderate, or unstable for personal loans'),
  body('propertyValue')
    .if(body('loanType').equals('property'))
    .isFloat({ gt: 0 })
    .withMessage('Property value in INR must be greater than 0 for property loans'),
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
