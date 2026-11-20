const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const validateRequest = require('../middleware/validationResult');
const loanController = require('../controllers/loanController');
const { PRODUCTS } = require('../services/lendingPolicy');

const router = express.Router();

const PURPOSES = ['debt_consolidation', 'home_renovation', 'medical', 'wedding', 'education', 'vehicle', 'business', 'travel', 'major_purchase', 'other'];
const isPersonal = body('loanType').equals('personal');
const isProperty = body('loanType').equals('property');
const hasCreditHistory = body('noCreditHistory').not().equals('true');

const loanValidation = [
  body('loanType').isIn(['personal', 'property']).withMessage('Loan type must be personal or property'),

  // Applicant
  body('fullName').trim().isLength({ min: 3, max: 100 }).withMessage('Enter your full name as on PAN'),
  body('dateOfBirth').isISO8601({ strict: true }).withMessage('Enter a valid date of birth'),
  body('pan')
    .trim()
    .toUpperCase()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
    .withMessage('PAN must look like ABCDE1234F'),

  // Income
  body('employmentType').isIn(['salaried', 'self_employed', 'retired', 'unemployed']).withMessage('Select your employment type'),
  body('monthlyIncome').isFloat({ min: 0, max: 100000000 }).withMessage('Enter your net monthly income in INR').toFloat(),
  body('yearsEmployed').optional({ values: 'falsy' }).isFloat({ min: 0, max: 60 }).withMessage('Years employed must be between 0 and 60').toFloat(),
  body('existingEmi').isFloat({ min: 0, max: 100000000 }).withMessage('Existing EMIs must be 0 or more').toFloat(),
  body('residenceType').isIn(['rented', 'owned', 'owned_mortgage', 'family']).withMessage('Select your residence type'),

  // Credit profile
  body('noCreditHistory').optional().isBoolean().toBoolean(),
  body('creditScore').if(hasCreditHistory).isInt({ min: 300, max: 900 }).withMessage('Credit score must be between 300 and 900').toInt(),
  body('missedPayments').if(hasCreditHistory).isInt({ min: 0, max: 50 }).withMessage('Enter the number of missed payments (0 if none)').toInt(),
  body('recentCreditApplications').if(hasCreditHistory).isInt({ min: 0, max: 50 }).withMessage('Enter the number of recent credit applications (0 if none)').toInt(),
  body('creditHistoryYears').if(hasCreditHistory).isFloat({ min: 0, max: 60 }).withMessage('Enter years since your first loan or credit card').toFloat(),

  // Loan
  body('loanAmount')
    .isFloat({ min: 1 })
    .toFloat()
    .custom((value, { req }) => {
      const product = PRODUCTS[req.body.loanType];
      if (product && (value < product.minAmount || value > product.maxAmount)) {
        throw new Error(`${product.label} amount must be between ₹${product.minAmount.toLocaleString('en-IN')} and ₹${product.maxAmount.toLocaleString('en-IN')}`);
      }
      return true;
    }),
  body('tenureMonths')
    .isInt({ min: 1 })
    .toInt()
    .custom((value, { req }) => {
      const product = PRODUCTS[req.body.loanType];
      if (product && (value < product.minTenure || value > product.maxTenure)) {
        throw new Error(`${product.label} tenure must be between ${product.minTenure} and ${product.maxTenure} months`);
      }
      return true;
    }),
  body('purpose').if(isPersonal).isIn(PURPOSES).withMessage('Select the purpose of the loan'),
  body('propertyValue').if(isProperty).isFloat({ min: 100000 }).withMessage('Enter the property value in INR (at least ₹1,00,000)').toFloat(),
];

router.post('/apply-loan', authMiddleware, loanValidation, validateRequest, loanController.applyLoan);
router.get('/my-loans', authMiddleware, loanController.getMyLoans);
router.get('/all-loans', authMiddleware, adminOnly, loanController.getAllLoans);
router.get('/model-info', authMiddleware, loanController.getModelInfo);
router.get('/loan/:id', authMiddleware, loanController.getLoanById);
router.put(
  '/loan/:id/status',
  authMiddleware,
  adminOnly,
  [
    body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
    body('adminNotes').optional().isString().isLength({ max: 1000 }),
  ],
  validateRequest,
  loanController.updateLoanStatus
);

module.exports = router;
