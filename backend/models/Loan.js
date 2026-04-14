const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    income: {
      type: Number,
      required: true,
    },
    creditScore: {
      type: Number,
      required: true,
    },
    loanAmount: {
      type: Number,
      required: true,
    },
    employment: {
      type: String,
      required: true,
    },
    personalInfo: {
      type: Object,
      default: {},
    },
    financialInfo: {
      type: Object,
      default: {},
    },
    employmentInfo: {
      type: Object,
      default: {},
    },
    loanDetails: {
      type: Object,
      default: {},
    },
    riskScore: {
      type: Number,
      default: 0,
    },
    riskCategory: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    explanation: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'review', 'approved', 'rejected'],
      default: 'pending',
    },
    decisionSource: {
      type: String,
      enum: ['ai', 'admin'],
      default: 'ai',
    },
    aiModel: {
      type: String,
      default: 'random_forest',
    },
    blockchainRecorded: {
      type: Boolean,
      default: false,
    },
    blockchainTxHash: {
      type: String,
      default: '',
    },
    adminNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Loan', loanSchema);
