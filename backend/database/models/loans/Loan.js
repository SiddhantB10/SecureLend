const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    loanType: { type: String, enum: ['personal', 'property'], default: 'personal', required: true },

    // ── Applicant ─────────────────────────────────────────────
    applicant: {
      fullName: { type: String, trim: true },
      dateOfBirth: { type: Date },
      panMasked: { type: String }, // e.g. ABCPX****F — full PAN is never stored
      panHash: { type: String, index: true }, // HMAC for duplicate-identity checks
    },

    // ── Income & obligations ──────────────────────────────────
    employmentType: { type: String, enum: ['salaried', 'self_employed', 'retired', 'unemployed'] },
    monthlyIncome: { type: Number },
    yearsEmployed: { type: Number, default: 0 },
    existingEmi: { type: Number, default: 0 },
    residenceType: { type: String, enum: ['rented', 'owned', 'owned_mortgage', 'family'] },

    // ── Credit profile ────────────────────────────────────────
    noCreditHistory: { type: Boolean, default: false },
    creditScore: { type: Number },
    missedPayments: { type: Number, default: 0 },
    recentCreditApplications: { type: Number, default: 0 },
    creditHistoryYears: { type: Number, default: 0 },

    // ── Loan request ──────────────────────────────────────────
    loanAmount: { type: Number, required: true },
    tenureMonths: { type: Number },
    purpose: { type: String },
    propertyValue: { type: Number, default: 0 },

    // ── Decision ──────────────────────────────────────────────
    riskScore: { type: Number, default: null }, // probability of default (0–1); null if not scored
    riskBand: { type: String },
    riskCategory: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: ['pending', 'review', 'approved', 'rejected'], default: 'pending', index: true },
    decisionSource: { type: String, enum: ['ai', 'admin'], default: 'ai' },
    assessment: { type: Object, default: {} }, // full decision: reasons, checks, offer, metrics
    aiModel: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
    reviewedAt: { type: Date },

    // ── Audit trail ───────────────────────────────────────────
    blockchainRecorded: { type: Boolean, default: false },
    blockchainTxHash: { type: String, default: '' },

    // ── Legacy fields (applications made before the v2 form) ──
    income: { type: Number },
    existingDebt: { type: Number },
    employmentStatus: { type: String },
    explanation: { type: String, default: '' },
    mlRiskScore: { type: Number },
    formulaRiskScore: { type: Number },
    personalInfo: { type: Object },
  },
  {
    timestamps: true,
    collection: 'loans',
  }
);

loanSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Loan || mongoose.model('Loan', loanSchema);
