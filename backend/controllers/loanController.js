const crypto = require('crypto');
const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const User = require('../models/User');
const { predictLoanRisk, getModelInfo } = require('../services/mlService');
const { scoreWithFallback } = require('../services/scorecardFallback');
const { recordLoanDecision } = require('../services/blockchainService');
const { logAdminAction } = require('../services/auditLogService');
const { assessApplication } = require('../services/decisionEngine');
const { PRODUCTS, riskCategoryFor, emi } = require('../services/lendingPolicy');

const PAN_HASH_SECRET = () => process.env.PAN_HASH_SECRET || process.env.JWT_SECRET || 'securelend';
const hashPan = (pan) => crypto.createHmac('sha256', PAN_HASH_SECRET()).update(pan).digest('hex');
const maskPan = (pan) => `${pan.slice(0, 5)}****${pan.slice(-1)}`;

const buildInput = (body) => {
  const noCreditHistory = body.noCreditHistory === true;
  const employmentType = body.employmentType;
  return {
    loanType: body.loanType,
    fullName: String(body.fullName).trim(),
    dateOfBirth: body.dateOfBirth,
    pan: String(body.pan).trim().toUpperCase(),
    employmentType,
    monthlyIncome: Number(body.monthlyIncome),
    // Retired applicants have no "current job"; a neutral value keeps the model input sensible.
    yearsEmployed: employmentType === 'retired' ? 5 : Number(body.yearsEmployed || 0),
    existingEmi: Number(body.existingEmi || 0),
    residenceType: body.residenceType,
    noCreditHistory,
    creditScore: noCreditHistory ? null : Number(body.creditScore),
    missedPayments: noCreditHistory ? 0 : Number(body.missedPayments || 0),
    recentCreditApplications: noCreditHistory ? 0 : Number(body.recentCreditApplications || 0),
    creditHistoryYears: noCreditHistory ? 0 : Number(body.creditHistoryYears || 0),
    loanAmount: Number(body.loanAmount),
    tenureMonths: Number(body.tenureMonths),
    purpose: body.loanType === 'personal' ? body.purpose : 'property',
    propertyValue: body.loanType === 'property' ? Number(body.propertyValue) : 0,
  };
};

const scoreApplication = async (input) => {
  const product = PRODUCTS[input.loanType];
  const payload = {
    loanType: input.loanType,
    // Applicants without credit history cannot be scored; a neutral score is sent only so the
    // service returns anomaly/explanation data — the decision engine routes them to review.
    creditScore: input.noCreditHistory ? 650 : input.creditScore,
    monthlyIncome: Math.max(input.monthlyIncome, 1),
    existingEmi: input.existingEmi,
    loanAmount: input.loanAmount,
    tenureMonths: input.tenureMonths,
    newEmi: emi(input.loanAmount, product.baseRate + 2.5, input.tenureMonths),
    yearsEmployed: Math.min(input.yearsEmployed, 60),
    residenceType: input.residenceType,
    purpose: input.loanType === 'personal' ? input.purpose : 'other',
    missedPayments: input.missedPayments,
    recentCreditApplications: input.recentCreditApplications,
    creditHistoryYears: input.creditHistoryYears,
  };

  try {
    return { ...(await predictLoanRisk(payload)), source: 'ml-service' };
  } catch (error) {
    console.error('ML service unavailable, using scorecard fallback:', error.message);
    return { ...scoreWithFallback(payload), source: 'scorecard-fallback' };
  }
};

const recordOnChain = async (loan) => {
  try {
    const chainResult = await recordLoanDecision({
      loanId: loan._id.toString(),
      loanType: loan.loanType,
      riskScore: loan.riskScore,
      decision: loan.status,
    });
    if (chainResult.blockchainEnabled) {
      loan.blockchainRecorded = true;
      loan.blockchainTxHash = chainResult.txHash;
      await loan.save();
    }
    return chainResult;
  } catch (error) {
    console.error('Blockchain logging failed:', error.message);
    return { blockchainEnabled: false, error: error.message };
  }
};

exports.applyLoan = async (req, res) => {
  try {
    const input = buildInput(req.body);
    const panHash = hashPan(input.pan);

    const [account, panOwner, recentApplications] = await Promise.all([
      User.findById(req.user.id).lean(),
      Loan.findOne({ 'applicant.panHash': panHash, userId: { $ne: req.user.id } }).select('_id').lean(),
      Loan.find({
        $or: [{ userId: req.user.id }, { 'applicant.panHash': panHash }],
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      })
        .select('createdAt monthlyIncome creditScore status')
        .lean(),
    ]);

    const ml = await scoreApplication(input);
    const assessment = assessApplication(input, ml, {
      accountName: account?.name || req.user.name,
      phoneVerified: Boolean(account?.phoneVerified),
      panUsedByOtherAccount: Boolean(panOwner),
      recentApplications,
    });
    assessment.scoringSource = ml.source;

    const loan = await Loan.create({
      userId: req.user.id,
      loanType: input.loanType,
      applicant: {
        fullName: input.fullName,
        dateOfBirth: new Date(input.dateOfBirth),
        panMasked: maskPan(input.pan),
        panHash,
      },
      employmentType: input.employmentType,
      monthlyIncome: input.monthlyIncome,
      yearsEmployed: input.yearsEmployed,
      existingEmi: input.existingEmi,
      residenceType: input.residenceType,
      noCreditHistory: input.noCreditHistory,
      creditScore: input.creditScore,
      missedPayments: input.missedPayments,
      recentCreditApplications: input.recentCreditApplications,
      creditHistoryYears: input.creditHistoryYears,
      loanAmount: input.loanAmount,
      tenureMonths: input.tenureMonths,
      purpose: input.purpose,
      propertyValue: input.propertyValue,
      riskScore: assessment.metrics.probabilityOfDefault ?? null,
      riskBand: assessment.metrics.riskBand,
      riskCategory: assessment.metrics.riskCategory,
      status: assessment.status,
      decisionSource: 'ai',
      assessment,
      aiModel: `${ml.model?.name || 'unknown'} (${ml.source})`,
    });

    if (loan.status !== 'review') {
      await recordOnChain(loan);
    }

    return res.status(201).json({ message: 'Loan application assessed', loan: sanitizeLoan(loan) });
  } catch (error) {
    console.error('applyLoan error:', error);
    return res.status(500).json({ message: 'Unable to process loan application. Please try again.' });
  }
};

/** Never send the PAN hash to the browser. */
const sanitizeLoan = (loan) => {
  const plain = typeof loan.toObject === 'function' ? loan.toObject() : { ...loan };
  if (plain.applicant) {
    plain.applicant = { ...plain.applicant };
    delete plain.applicant.panHash;
  }
  return plain;
};

exports.getMyLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    return res.json({ loans: loans.map(sanitizeLoan) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load your applications' });
  }
};

exports.getAllLoans = async (req, res) => {
  try {
    const loans = await Loan.find().populate('userId', 'name email phone role').sort({ createdAt: -1 }).lean();
    return res.json({ loans: loans.map(sanitizeLoan) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load applications' });
  }
};

exports.getLoanById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Loan application not found' });
    }

    const loan = await Loan.findById(req.params.id).populate('userId', 'name email phone role').lean();
    if (!loan) {
      return res.status(404).json({ message: 'Loan application not found' });
    }

    // Users may only view their own applications; admins can view all.
    const ownerId = loan.userId?._id ? loan.userId._id.toString() : String(loan.userId);
    if (req.user.role !== 'admin' && ownerId !== req.user.id) {
      return res.status(404).json({ message: 'Loan application not found' });
    }

    return res.json({ loan: sanitizeLoan(loan) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load application' });
  }
};

exports.getModelInfo = async (req, res) => {
  try {
    return res.json(await getModelInfo());
  } catch (error) {
    return res.status(503).json({ message: 'Model information is temporarily unavailable' });
  }
};

exports.updateLoanStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Loan application not found' });
    }
    const loan = await Loan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ message: 'Loan application not found' });
    }

    if (!['review', 'pending'].includes(loan.status)) {
      return res.status(400).json({
        message: 'Only applications in review can be manually approved or rejected',
      });
    }

    loan.status = status;
    loan.decisionSource = 'admin';
    loan.reviewedBy = mongoose.isValidObjectId(req.user.id) ? req.user.id : undefined;
    loan.reviewedAt = new Date();
    if (typeof adminNotes === 'string' && adminNotes.trim()) {
      loan.adminNotes = adminNotes.trim();
    }

    if (loan.assessment && Object.keys(loan.assessment).length) {
      const note = loan.adminNotes ? ` Officer's note: ${loan.adminNotes}` : '';
      loan.assessment = {
        ...loan.assessment,
        status,
        headline: status === 'approved' ? 'Approved after manual review by a loan officer.' : 'Declined after manual review by a loan officer.',
        summary: `${loan.assessment.summary || ''} A loan officer reviewed the flagged points and ${status === 'approved' ? 'approved' : 'declined'} the application.${note}`.trim(),
      };
      loan.markModified('assessment');
    }
    if (loan.riskBand) {
      loan.riskCategory = riskCategoryFor(loan.riskBand);
    }

    await loan.save();

    await logAdminAction({
      adminId: req.user.id,
      action: status === 'approved' ? 'LOAN_APPROVED' : 'LOAN_REJECTED',
      entityType: 'loan',
      entityId: loan._id,
      notes: loan.adminNotes,
      metadata: {
        loanType: loan.loanType,
        loanAmount: loan.loanAmount,
        riskBand: loan.riskBand,
        probabilityOfDefault: loan.riskScore,
        previousStatus: 'review',
      },
    });

    const chainResult = loan.blockchainRecorded ? { blockchainEnabled: true } : await recordOnChain(loan);
    return res.json({
      message: chainResult.blockchainEnabled
        ? 'Loan status updated successfully'
        : 'Loan status updated successfully, but blockchain logging is unavailable',
      loan: sanitizeLoan(loan),
      ...(chainResult.blockchainEnabled ? {} : { blockchainWarning: chainResult.error }),
    });
  } catch (error) {
    console.error('updateLoanStatus error:', error);
    return res.status(500).json({ message: 'Unable to update loan status' });
  }
};
