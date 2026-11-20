/**
 * Lending policy configuration and financial helpers.
 *
 * Values follow common Indian retail-lending practice:
 * - FOIR (Fixed Obligation to Income Ratio): all EMIs incl. the new one / net monthly income.
 * - RBI loan-to-value caps for individual housing loans:
 *   up to ₹30 lakh → 90%, ₹30–75 lakh → 80%, above ₹75 lakh → 75%.
 * Tune these for your institution's credit policy.
 */

const LAKH = 100000;

const PRODUCTS = {
  personal: {
    label: 'Personal loan',
    minAmount: 50000,
    maxAmount: 40 * LAKH,
    minTenure: 12,
    maxTenure: 60,
    baseRate: 10.5, // % p.a. for the best risk band
    minMonthlyIncome: 15000,
    approvePd: 0.12, // approve below this probability of default
    declinePd: 0.22, // decline at or above this; in between → manual review
  },
  property: {
    label: 'Property loan',
    minAmount: 5 * LAKH,
    maxAmount: 1000 * LAKH,
    minTenure: 60,
    maxTenure: 360,
    baseRate: 8.5,
    minMonthlyIncome: 25000,
    // Secured by collateral, so a lender can accept a higher default probability.
    approvePd: 0.16,
    declinePd: 0.26,
  },
};

const FOIR_COMFORTABLE = 0.5; // ≤ 50%: comfortable
const FOIR_MAX = 0.6; // > 60%: declined; 50–60%: manual review

const MIN_CREDIT_SCORE = 600; // below: declined
const REVIEW_CREDIT_SCORE = 650; // 600–649: manual review

const MIN_AGE = 21;
const MAX_AGE_AT_MATURITY = { salaried: 60, self_employed: 65, retired: 75 };
const MIN_YEARS_EMPLOYED = { salaried: 0.5, self_employed: 2 };

const RISK_BANDS = [
  { band: 'Very low', min: 0, max: 0.07, ratePremium: 0 },
  { band: 'Low', min: 0.07, max: 0.12, ratePremium: 1.0 },
  { band: 'Medium', min: 0.12, max: 0.2, ratePremium: 2.5 },
  { band: 'High', min: 0.2, max: 0.3, ratePremium: 4.5 },
  { band: 'Very high', min: 0.3, max: Infinity, ratePremium: 6.5 },
];

const riskBandFor = (pd) => RISK_BANDS.find((b) => pd >= b.min && pd < b.max) || RISK_BANDS[RISK_BANDS.length - 1];

/** Legacy 3-level category kept for dashboards/charts. */
const riskCategoryFor = (band) => {
  if (band === 'Very low' || band === 'Low') return 'Low';
  if (band === 'Medium') return 'Medium';
  return 'High';
};

/** RBI LTV cap for a housing loan of the given amount. */
const ltvCapFor = (loanAmount) => {
  if (loanAmount <= 30 * LAKH) return 0.9;
  if (loanAmount <= 75 * LAKH) return 0.8;
  return 0.75;
};

/** Largest loan allowed against a property value under the RBI slabs. */
const maxLoanByLtv = (propertyValue) => {
  const candidates = [Math.min(0.9 * propertyValue, 30 * LAKH)];
  if (0.8 * propertyValue > 30 * LAKH) candidates.push(Math.min(0.8 * propertyValue, 75 * LAKH));
  if (0.75 * propertyValue > 75 * LAKH) candidates.push(0.75 * propertyValue);
  return Math.max(...candidates);
};

/** Reducing-balance EMI. */
const emi = (principal, annualRatePct, months) => {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const f = (1 + r) ** months;
  return (principal * r * f) / (f - 1);
};

/** Principal that a given EMI can service. */
const principalForEmi = (monthlyEmi, annualRatePct, months) => {
  if (monthlyEmi <= 0 || months <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return monthlyEmi * months;
  const f = (1 + r) ** months;
  return (monthlyEmi * (f - 1)) / (r * f);
};

const ageOn = (dateOfBirth, at = new Date()) => {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = at.getFullYear() - dob.getFullYear();
  const m = at.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < dob.getDate())) age -= 1;
  return age;
};

const inrFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const formatInr = (value) => inrFormatter.format(Math.round(Number(value) || 0));
const pct = (value, digits = 0) => `${(Number(value) * 100).toFixed(digits)}%`;

module.exports = {
  LAKH,
  PRODUCTS,
  FOIR_COMFORTABLE,
  FOIR_MAX,
  MIN_CREDIT_SCORE,
  REVIEW_CREDIT_SCORE,
  MIN_AGE,
  MAX_AGE_AT_MATURITY,
  MIN_YEARS_EMPLOYED,
  RISK_BANDS,
  riskBandFor,
  riskCategoryFor,
  ltvCapFor,
  maxLoanByLtv,
  emi,
  principalForEmi,
  ageOn,
  formatInr,
  pct,
};
