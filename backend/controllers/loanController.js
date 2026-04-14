const Loan = require('../models/Loan');
const { predictLoanRisk } = require('../services/mlService');
const { recordLoanDecision } = require('../services/blockchainService');

const buildApplicantPayload = (body) => ({
  income: Number(body.income),
  creditScore: Number(body.creditScore),
  loanAmount: Number(body.loanAmount),
  employment: body.employment,
});

const determineCategory = (riskScore) => {
  if (riskScore < 0.3) {
    return 'Low';
  }

  if (riskScore <= 0.7) {
    return 'Medium';
  }

  return 'High';
};

const determineAiDecision = (riskScore) => {
  if (riskScore < 0.3) {
    return {
      status: 'approved',
      reason: 'Auto-approved by AI because risk is below 0.30.',
    };
  }

  if (riskScore <= 0.7) {
    return {
      status: 'review',
      reason: 'Sent to admin for manual decision because risk is between 0.30 and 0.70.',
    };
  }

  return {
    status: 'rejected',
    reason: 'Auto-rejected by AI because risk is above 0.70.',
  };
};

exports.applyLoan = async (req, res) => {
  try {
    const applicantPayload = buildApplicantPayload(req.body);
    const prediction = await predictLoanRisk(applicantPayload);
    const category = prediction.category || determineCategory(prediction.riskScore);
    const aiDecision = determineAiDecision(prediction.riskScore);

    const loan = await Loan.create({
      userId: req.user.id,
      ...applicantPayload,
      personalInfo: req.body.personalInfo || {},
      financialInfo: req.body.financialInfo || {},
      employmentInfo: req.body.employmentInfo || {},
      loanDetails: req.body.loanDetails || {},
      riskScore: prediction.riskScore,
      riskCategory: category,
      explanation: prediction.explanation,
      status: aiDecision.status,
      decisionSource: 'ai',
      aiModel: prediction.model || 'random_forest',
      adminNotes: aiDecision.reason,
    });

    return res.status(201).json({
      message: 'Loan application submitted successfully',
      loan,
      prediction,
      decision: {
        source: 'ai',
        status: aiDecision.status,
        reason: aiDecision.reason,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to process loan application', error: error.message });
  }
};

exports.getMyLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ loans });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load your applications', error: error.message });
  }
};

exports.getAllLoans = async (req, res) => {
  try {
    const loans = await Loan.find().populate('userId', 'name email role').sort({ createdAt: -1 });
    return res.json({ loans });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load applications', error: error.message });
  }
};

exports.getLoanById = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('userId', 'name email phone role');
    if (!loan) {
      return res.status(404).json({ message: 'Loan application not found' });
    }

    return res.json({ loan });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load application', error: error.message });
  }
};

exports.updateLoanStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const loan = await Loan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ message: 'Loan application not found' });
    }

    if (loan.status !== 'review') {
      return res.status(400).json({
        message: 'Only applications in review can be manually approved or rejected',
      });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        message: 'Admin can only set status to approved or rejected',
      });
    }

    loan.status = status;
    loan.decisionSource = 'admin';
    if (typeof adminNotes === 'string') {
      loan.adminNotes = adminNotes;
    }

    await loan.save();

    if (!loan.blockchainRecorded && status !== 'pending') {
      try {
        const chainResult = await recordLoanDecision({
          loanId: loan._id.toString(),
          riskScore: loan.riskScore,
          decision: status,
        });

        loan.blockchainRecorded = chainResult.blockchainEnabled;
        loan.blockchainTxHash = chainResult.txHash;
        await loan.save();
      } catch (chainError) {
        return res.json({
          message: 'Loan status updated successfully, but blockchain logging is unavailable',
          loan,
          blockchainWarning: chainError.message,
        });
      }
    }

    return res.json({
      message: 'Loan status updated successfully',
      loan,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update loan status', error: error.message });
  }
};
