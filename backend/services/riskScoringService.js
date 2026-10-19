const EMPLOYMENT_RISK_FACTORS = {
  stable: 0.2,
  moderate: 0.5,
  unstable: 0.8,
};

const clampRiskScore = (score) => {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(1, score));
};

const normalizeLoanType = (loanType) => {
  const normalized = String(loanType || 'personal').trim().toLowerCase();
  return normalized === 'property' ? 'property' : 'personal';
};

const normalizeEmploymentStatus = (employmentStatus) => {
  const normalized = String(employmentStatus || 'stable').trim().toLowerCase();
  if (Object.hasOwn(EMPLOYMENT_RISK_FACTORS, normalized)) {
    return normalized;
  }
  return 'stable';
};

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const computeFormulaScore = (payload) => {
  const loanType = normalizeLoanType(payload.loanType);
  const income = toPositiveNumber(payload.income, 1);
  const loanAmount = toPositiveNumber(payload.loanAmount, 0);
  const creditScore = toPositiveNumber(payload.creditScore, 300);
  const existingDebt = toNonNegativeNumber(payload.existingDebt, 0);
  const propertyValue = toPositiveNumber(payload.propertyValue, 1);
  const employmentStatus = normalizeEmploymentStatus(payload.employmentStatus || payload.employment);

  const debtToIncomeRatio = existingDebt / income;
  const creditRiskFactor = 1 - creditScore / 900;
  const explanationMarkers = [];
  let formulaScore = 0;
  const engineered = {
    debtToIncomeRatio,
    creditRiskFactor,
    loanToIncomeRatio: 0,
    loanToValueRatio: 0,
    employmentRiskFactor: EMPLOYMENT_RISK_FACTORS[employmentStatus],
  };

  if (loanType === 'personal') {
    const loanToIncomeRatio = loanAmount / income;
    const employmentRiskFactor = EMPLOYMENT_RISK_FACTORS[employmentStatus];
    engineered.loanToIncomeRatio = loanToIncomeRatio;
    engineered.employmentRiskFactor = employmentRiskFactor;

    formulaScore =
      0.35 * debtToIncomeRatio +
      0.3 * loanToIncomeRatio +
      0.2 * creditRiskFactor +
      0.15 * employmentRiskFactor;

    if (loanToIncomeRatio > 0.5) {
      explanationMarkers.push('High loan-to-income ratio');
    }
    if (debtToIncomeRatio > 0.4) {
      explanationMarkers.push('High debt-to-income ratio');
    }
    if (creditScore < 650) {
      explanationMarkers.push('Low credit score');
    }
    if (employmentStatus === 'unstable') {
      explanationMarkers.push('Unstable employment profile');
    }
  } else {
    const loanToValueRatio = loanAmount / propertyValue;
    engineered.loanToValueRatio = loanToValueRatio;

    formulaScore =
      0.4 * loanToValueRatio +
      0.3 * debtToIncomeRatio +
      0.2 * creditRiskFactor +
      0.1 * (1 - creditScore / 900);

    if (loanToValueRatio > 0.8) {
      explanationMarkers.push('High loan-to-value ratio');
    }
    if (debtToIncomeRatio > 0.4) {
      explanationMarkers.push('High debt-to-income ratio');
    }
    if (creditScore < 650) {
      explanationMarkers.push('Low credit score');
    }
  }

  return {
    loanType,
    employmentStatus,
    formulaScore: clampRiskScore(formulaScore),
    explanationMarkers,
    engineered,
  };
};

module.exports = {
  EMPLOYMENT_RISK_FACTORS,
  clampRiskScore,
  normalizeLoanType,
  normalizeEmploymentStatus,
  computeFormulaScore,
};
