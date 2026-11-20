/**
 * SecureLend decision engine.
 *
 * Combines three layers, the way a real lender's underwriting system does:
 *   1. Identity & fraud checks   (PAN validity, PAN/name match, duplicate identity, velocity,
 *                                 inconsistent data, income manipulation, ML anomaly detector)
 *   2. Lending policy rules      (age, employment, minimum income, credit-score floor,
 *                                 missed payments, FOIR affordability, RBI loan-to-value caps)
 *   3. Credit-risk model         (probability of default from the ML service, trained on real
 *                                 loan outcomes) → risk band → risk-based interest rate
 *
 * and turns them into a decision with plain-language reasons, strengths, and next steps.
 * The engine is a pure function: all database lookups are passed in via `context`.
 */
const {
  PRODUCTS,
  FOIR_COMFORTABLE,
  FOIR_MAX,
  MIN_CREDIT_SCORE,
  REVIEW_CREDIT_SCORE,
  MIN_AGE,
  MAX_AGE_AT_MATURITY,
  MIN_YEARS_EMPLOYED,
  riskBandFor,
  riskCategoryFor,
  ltvCapFor,
  maxLoanByLtv,
  emi,
  principalForEmi,
  ageOn,
  formatInr,
  pct,
} = require('./lendingPolicy');

const PAN_REGEX = /^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/; // 4th char 'P' = individual

const normaliseName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !['mr', 'mrs', 'ms', 'dr', 'shri', 'smt'].includes(t));

const namesMatch = (a, b) => {
  const left = normaliseName(a);
  const right = normaliseName(b);
  if (!left.length || !right.length) return true;
  const overlap = left.filter((t) => right.includes(t));
  return overlap.length >= Math.min(2, Math.min(left.length, right.length));
};

const SEVERITY_ORDER = { decline: 3, review: 2, info: 1, pass: 0 };

/**
 * @param {object} input   validated application fields
 * @param {object} ml      ML /predict response (or scorecard fallback)
 * @param {object} context { accountName, phoneVerified, panUsedByOtherAccount, recentApplications[], now }
 */
const assessApplication = (input, ml, context = {}) => {
  const now = context.now || new Date();
  const product = PRODUCTS[input.loanType];
  const checks = []; // identity / fraud checks (shown to applicant and admin)
  const findings = []; // everything that can affect the decision
  const strengths = [];

  const addFinding = (severity, code, title, detail, tip) => findings.push({ severity, code, title, detail, tip });
  const addCheck = (status, code, title, detail) => checks.push({ status, code, title, detail });

  const age = ageOn(input.dateOfBirth, now);
  const ageAtMaturity = age === null ? null : age + input.tenureMonths / 12;
  const income = input.monthlyIncome;

  // ── 1. Identity & fraud checks ────────────────────────────────────────────
  const pan = String(input.pan || '').toUpperCase();
  if (!PAN_REGEX.test(pan)) {
    addCheck('fail', 'PAN_INVALID', 'PAN format', 'Not a valid individual PAN (format ABCPE1234F).');
    addFinding('decline', 'PAN_INVALID', 'Invalid PAN', 'The PAN entered is not a valid PAN for an individual.', 'Enter the PAN exactly as printed on your PAN card.');
  } else {
    addCheck('pass', 'PAN_FORMAT', 'PAN format', 'Valid individual PAN format.');
    const surname = normaliseName(input.fullName).slice(-1)[0] || '';
    if (surname && pan[4] !== surname[0].toUpperCase()) {
      addCheck('warn', 'PAN_NAME_MISMATCH', 'PAN matches name', `The 5th character of a PAN is the first letter of the holder's surname; "${pan[4]}" does not match "${surname}".`);
      addFinding('review', 'PAN_NAME_MISMATCH', 'PAN does not match the applicant name', 'The PAN may belong to someone else, so identity needs manual verification.', 'Make sure the name and PAN are exactly as on your PAN card.');
    } else {
      addCheck('pass', 'PAN_NAME', 'PAN matches name', 'PAN is consistent with the applicant surname.');
    }
  }

  if (context.panUsedByOtherAccount) {
    addCheck('fail', 'PAN_DUPLICATE', 'Unique identity', 'This PAN is already used on another SecureLend account.');
    addFinding('review', 'PAN_DUPLICATE', 'PAN already linked to another account', 'One person should hold one account; this needs identity verification.', 'If this is your PAN, contact support to merge or recover your account.');
  } else {
    addCheck('pass', 'PAN_UNIQUE', 'Unique identity', 'PAN is not linked to any other account.');
  }

  if (context.accountName && !namesMatch(input.fullName, context.accountName)) {
    addCheck('warn', 'NAME_ACCOUNT_MISMATCH', 'Applicant is account holder', `Applicant name "${input.fullName}" differs from the account name "${context.accountName}".`);
    addFinding('review', 'NAME_ACCOUNT_MISMATCH', 'Applying on behalf of someone else', 'The applicant name differs from the verified account holder.', 'Apply from the account that belongs to the borrower.');
  } else {
    addCheck('pass', 'NAME_ACCOUNT', 'Applicant is account holder', 'Name matches the verified account.');
  }

  addCheck(
    context.phoneVerified ? 'pass' : 'info',
    'PHONE_OTP',
    'Mobile number verified',
    context.phoneVerified ? 'Mobile number verified by OTP at signup.' : 'Mobile OTP could not be delivered at signup; email was verified.'
  );

  const recent = context.recentApplications || [];
  const last24h = recent.filter((a) => now - new Date(a.createdAt) < 24 * 3600 * 1000);
  if (last24h.length >= 3) {
    addCheck('warn', 'VELOCITY', 'Application frequency', `${last24h.length} other applications in the last 24 hours.`);
    addFinding('review', 'VELOCITY', 'Many applications in a short time', 'Repeated applications within 24 hours are a common fraud and "loan stacking" pattern.', 'Wait for your current applications to be decided before applying again.');
  } else {
    addCheck('pass', 'VELOCITY', 'Application frequency', 'Normal application frequency.');
  }

  const last30d = recent.filter((a) => now - new Date(a.createdAt) < 30 * 24 * 3600 * 1000);
  const incomeJump = last30d.find((a) => a.monthlyIncome && Math.abs(input.monthlyIncome - a.monthlyIncome) / a.monthlyIncome > 0.25);
  const scoreJump = last30d.find((a) => a.creditScore && input.creditScore && Math.abs(input.creditScore - a.creditScore) > 50);
  if (incomeJump || scoreJump) {
    const what = [
      incomeJump && `income ${formatInr(incomeJump.monthlyIncome)} → ${formatInr(input.monthlyIncome)}`,
      scoreJump && `credit score ${scoreJump.creditScore} → ${input.creditScore}`,
    ]
      .filter(Boolean)
      .join(', ');
    addCheck('warn', 'DATA_CHANGED', 'Consistent with earlier applications', `Changed within 30 days: ${what}.`);
    addFinding('review', 'DATA_CHANGED', 'Details changed since your last application', `Within 30 days you reported ${what}. Large changes need documents to confirm them.`, 'Keep salary slips / ITR and your credit report ready for verification.');
  } else if (last30d.length) {
    addCheck('pass', 'DATA_CONSISTENT', 'Consistent with earlier applications', 'Details match your recent applications.');
  }

  if (age !== null) {
    const maxCareer = Math.max(age - 15, 0);
    const maxCreditHistory = Math.max(age - 18, 0);
    const inconsistencies = [];
    if (input.yearsEmployed > maxCareer) inconsistencies.push(`${input.yearsEmployed} years in current job at age ${age}`);
    if (!input.noCreditHistory && input.creditHistoryYears > maxCreditHistory) inconsistencies.push(`${input.creditHistoryYears} years of credit history at age ${age}`);
    if (inconsistencies.length) {
      addCheck('fail', 'INCONSISTENT_DATA', 'Data consistency', `Not possible for the stated age: ${inconsistencies.join('; ')}.`);
      addFinding('review', 'INCONSISTENT_DATA', 'Details are inconsistent with your age', inconsistencies.join('; ') + '.', 'Check your date of birth, years employed and credit history.');
    } else {
      addCheck('pass', 'DATA_CONSISTENCY', 'Data consistency', 'Age, employment and credit history are consistent.');
    }
  }

  if (income > 50 * 100000) {
    addFinding('review', 'HIGH_VALUE_INCOME', 'Very high declared income', `Declared income of ${formatInr(income)} per month needs document verification.`, 'Keep ITR / bank statements ready.');
  }

  if (ml?.anomaly?.isAnomalous) {
    addCheck('warn', 'ANOMALY', 'Typical application pattern', 'This combination of details is unusual compared with 42,000+ real borrowers.');
    addFinding('review', 'ANOMALY', 'Unusual combination of details', 'The anomaly detector found this profile unlike real borrower profiles, so it is verified manually.', null);
  } else if (ml?.anomaly && ml.anomaly.score !== null) {
    addCheck('pass', 'ANOMALY', 'Typical application pattern', 'Profile is consistent with real borrower patterns.');
  }

  // ── 2. Lending policy ─────────────────────────────────────────────────────
  if (age === null) {
    addFinding('decline', 'DOB_INVALID', 'Invalid date of birth', 'Date of birth could not be read.', null);
  } else if (age < MIN_AGE) {
    addFinding('decline', 'AGE_MIN', `Minimum age is ${MIN_AGE}`, `You are ${age}. Applicants must be at least ${MIN_AGE} years old.`, 'You can apply with a co-applicant (parent/guardian) at a bank branch.');
  } else if (input.employmentType !== 'unemployed') {
    const maxAge = MAX_AGE_AT_MATURITY[input.employmentType];
    if (ageAtMaturity > maxAge) {
      const maxTenure = Math.floor((maxAge - age) * 12);
      const tip = maxTenure >= product.minTenure ? `Choose a tenure of ${maxTenure} months or less.` : 'Consider applying with a younger co-applicant.';
      addFinding('decline', 'AGE_MATURITY', 'Loan would end after the age limit', `You would be ${ageAtMaturity.toFixed(0)} at the end of the loan; the limit for ${input.employmentType.replace('_', '-')} applicants is ${maxAge}.`, tip);
    }
  }

  if (input.employmentType === 'unemployed') {
    addFinding('decline', 'NO_INCOME_SOURCE', 'No regular income', 'A regular income (salary, business or pension) is required to repay the loan.', 'Apply once you have a regular income, or with an earning co-applicant.');
  } else {
    const minYears = MIN_YEARS_EMPLOYED[input.employmentType];
    if (minYears && input.yearsEmployed < minYears) {
      addFinding('review', 'SHORT_TENURE_JOB', input.employmentType === 'salaried' ? 'Less than 6 months in current job' : 'Business is less than 2 years old', 'Short employment or business history makes income stability uncertain.', input.employmentType === 'salaried' ? 'Applying after 6 months in your job improves approval chances.' : 'Keep 2 years of ITRs ready for verification.');
    } else if (input.yearsEmployed >= 3) {
      strengths.push(`${input.yearsEmployed} years in your current ${input.employmentType === 'self_employed' ? 'business' : 'job'} shows stable income.`);
    }
  }

  const hasIncome = input.employmentType !== 'unemployed' && income > 0;

  if (hasIncome && income < product.minMonthlyIncome) {
    addFinding('decline', 'MIN_INCOME', 'Income below minimum', `Minimum net income for a ${product.label.toLowerCase()} is ${formatInr(product.minMonthlyIncome)}/month; you entered ${formatInr(income)}.`, 'Add an earning co-applicant to combine incomes.');
  }

  if (input.noCreditHistory) {
    addFinding('review', 'NO_CREDIT_HISTORY', 'No credit history', 'Without a credit history the risk model cannot score you, so an officer will assess your income documents.', 'A small secured credit card or consumer loan repaid on time builds a credit score within 6–12 months.');
  } else if (input.creditScore < MIN_CREDIT_SCORE) {
    addFinding('decline', 'CREDIT_SCORE_LOW', 'Credit score too low', `Your credit score of ${input.creditScore} is below our minimum of ${MIN_CREDIT_SCORE}.`, 'Pay all EMIs and card bills on time and keep card usage below 30% of the limit; scores usually recover in 6–12 months.');
  } else if (input.creditScore < REVIEW_CREDIT_SCORE) {
    addFinding('review', 'CREDIT_SCORE_FAIR', 'Fair credit score', `A credit score of ${input.creditScore} is below ${REVIEW_CREDIT_SCORE}, so the application needs manual review.`, 'Improving your score above 700 qualifies you for automatic approval and lower rates.');
  } else if (input.creditScore >= 750) {
    strengths.push(`Excellent credit score of ${input.creditScore}.`);
  }

  if (!input.noCreditHistory) {
    if (input.missedPayments >= 3) {
      addFinding('decline', 'MISSED_PAYMENTS', 'Repeated missed payments', `${input.missedPayments} payments were 30+ days late in the last 2 years.`, 'Clear any overdue amounts and keep 12 months of on-time payments before reapplying.');
    } else if (input.missedPayments >= 1) {
      addFinding('review', 'MISSED_PAYMENTS', 'Recent missed payment', `${input.missedPayments} payment(s) were 30+ days late in the last 2 years.`, 'Set up auto-debit for EMIs and card bills to avoid late payments.');
    } else {
      strengths.push('No missed payments in the last 2 years.');
    }
    if (input.recentCreditApplications >= 6) {
      addFinding('review', 'CREDIT_HUNGRY', 'Many recent credit applications', `${input.recentCreditApplications} credit applications in 6 months suggests credit stress.`, 'Avoid applying for new credit for the next few months.');
    }
  }

  // ── 3. Risk model, pricing and affordability ──────────────────────────────
  const scored = !input.noCreditHistory;
  const pd = scored ? Number(ml.probabilityOfDefault) : null;
  // Unscored (no credit history) applicants are priced as Medium risk pending manual review.
  const band = scored ? riskBandFor(pd) : riskBandFor(0.15);
  const interestRate = Number((product.baseRate + band.ratePremium).toFixed(2));
  const monthlyEmi = emi(input.loanAmount, interestRate, input.tenureMonths);
  const foir = hasIncome ? (input.existingEmi + monthlyEmi) / income : null;
  const existingFoir = hasIncome ? input.existingEmi / income : null;

  // Largest amount affordable at a comfortable FOIR (and within LTV for property loans).
  const affordableEmi = hasIncome ? Math.max(FOIR_COMFORTABLE * income - input.existingEmi, 0) : 0;
  let eligibleAmount = principalForEmi(affordableEmi, interestRate, input.tenureMonths);
  let ltv = null;
  let ltvCap = null;
  if (input.loanType === 'property') {
    ltv = input.loanAmount / input.propertyValue;
    ltvCap = ltvCapFor(input.loanAmount);
    eligibleAmount = Math.min(eligibleAmount, maxLoanByLtv(input.propertyValue));
  }
  eligibleAmount = Math.min(eligibleAmount, product.maxAmount);
  eligibleAmount = Math.floor(eligibleAmount / 10000) * 10000; // round down to ₹10,000
  const counterOffer = eligibleAmount >= product.minAmount && eligibleAmount < input.loanAmount ? eligibleAmount : null;
  const canExtend = input.tenureMonths < product.maxTenure;
  const counterTip = counterOffer
    ? `You may qualify for up to ${formatInr(counterOffer)} over ${input.tenureMonths} months${canExtend ? ', or choose a longer tenure to lower the EMI' : ''}.`
    : `Reduce existing EMIs${canExtend ? ', choose a longer tenure' : ''} or add an earning co-applicant.`;

  if (!hasIncome) {
    // Already declined for having no regular income.
  } else if (foir > FOIR_MAX) {
    addFinding('decline', 'FOIR_HIGH', 'EMIs would be too high for your income', `All EMIs including this loan (${formatInr(input.existingEmi + monthlyEmi)}/month) would take ${pct(foir)} of your income; the limit is ${pct(FOIR_MAX)}.`, counterTip);
  } else if (foir > FOIR_COMFORTABLE) {
    addFinding('review', 'FOIR_STRETCHED', 'EMIs would stretch your budget', `All EMIs would take ${pct(foir)} of your income (comfortable limit ${pct(FOIR_COMFORTABLE)}).`, counterTip);
  } else {
    strengths.push(`EMIs would take ${pct(foir)} of your income, within the ${pct(FOIR_COMFORTABLE)} comfort limit.`);
  }

  if (input.loanType === 'property') {
    if (ltv > ltvCap) {
      addFinding('decline', 'LTV_HIGH', 'Loan is too high for the property value', `You asked for ${pct(ltv)} of the property value; RBI allows at most ${pct(ltvCap)} for a loan of ${formatInr(input.loanAmount)}.`, `Increase your down payment. The maximum loan against this property is ${formatInr(maxLoanByLtv(input.propertyValue))}.`);
    } else {
      strengths.push(`Loan is ${pct(ltv)} of the property value, within the RBI limit of ${pct(ltvCap)}.`);
    }
  }

  // Model-driven reasons (only when the applicant can be scored).
  const modelDrivers = (ml.contributions || []).filter((c) => Math.abs(c.impact) >= 0.01);
  const riskDrivers = modelDrivers.filter((c) => c.impact > 0).slice(0, 3);
  const helpers = modelDrivers.filter((c) => c.impact < 0).slice(0, 3);
  const driverText = riskDrivers.length
    ? ` Main factors: ${riskDrivers
        .map((c) => (c.value ? `${c.label.toLowerCase()} ${c.value}${c.typicalValue ? ` (typical repaid borrower: ${c.typicalValue})` : ''}` : c.label.toLowerCase()))
        .join('; ')}.`
    : '';
  if (scored && hasIncome) {
    if (pd >= product.declinePd) {
      addFinding('decline', 'PD_HIGH', `${band.band} risk of default`, `Borrowers with a similar profile default about ${pct(pd)} of the time — above our limit of ${pct(product.declinePd)}.${driverText}`, 'Improving your credit score and reducing recent credit applications lowers your risk.');
    } else if (pd >= product.approvePd) {
      addFinding('review', 'PD_MEDIUM', `${band.band} risk of default`, `Estimated default probability is ${pct(pd, 1)}, above the ${pct(product.approvePd)} automatic-approval limit.${driverText}`, 'A higher credit score, fewer new credit applications or a shorter tenure would lower your risk.');
    } else {
      strengths.push(`${band.band} risk profile: estimated default probability ${pct(pd, 1)}.`);
    }
  }

  // ── 4. Decision ───────────────────────────────────────────────────────────
  const declines = findings.filter((f) => f.severity === 'decline');
  const reviews = findings.filter((f) => f.severity === 'review');
  let status = 'approved';
  if (declines.length) status = 'rejected';
  else if (reviews.length) status = 'review';

  const offer = status === 'rejected'
    ? null
    : {
        amount: input.loanAmount,
        interestRate,
        tenureMonths: input.tenureMonths,
        emi: Math.round(monthlyEmi),
        totalInterest: Math.round(monthlyEmi * input.tenureMonths - input.loanAmount),
        totalPayable: Math.round(monthlyEmi * input.tenureMonths),
      };

  const primary = (status === 'rejected' ? declines : reviews).sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
  let headline;
  if (status === 'approved') {
    headline = `Approved: ${formatInr(input.loanAmount)} at ${interestRate}% p.a. for ${input.tenureMonths} months — EMI ${formatInr(monthlyEmi)}.`;
  } else if (status === 'review') {
    headline = `Sent for manual review — ${primary.map((f) => f.title).slice(0, 2).join('; ')}.`;
  } else {
    headline = `Declined — ${primary[0].title}.`;
  }

  let summary;
  if (status === 'approved') {
    summary = `Your application passed all identity and fraud checks and every lending rule. ${strengths.slice(0, 2).join(' ')} Final sanction is subject to KYC and income-document verification.`;
  } else if (status === 'review') {
    summary = `Your application is not declined. ${primary.length === 1 ? 'One point needs' : `${primary.length} points need`} a loan officer's review before a decision: ${primary.map((f) => f.title).join('; ')}. Reviews are usually completed within 1–2 working days.`;
  } else {
    summary = `We could not approve this application because: ${declines.map((f) => f.detail).join(' ')}`;
  }

  const improvements = [...new Set(findings.filter((f) => f.tip).map((f) => f.tip))];

  return {
    status,
    headline,
    summary,
    reasons: findings.map(({ severity, code, title, detail }) => ({ severity, code, title, detail })),
    strengths,
    improvements,
    checks,
    riskDrivers: (scored ? riskDrivers : []).map((c) => ({ label: c.label, value: c.value, typicalValue: c.typicalValue, impact: c.impact })),
    riskReducers: (scored ? helpers : []).map((c) => ({ label: c.label, value: c.value, typicalValue: c.typicalValue, impact: c.impact })),
    offer,
    counterOffer,
    metrics: {
      probabilityOfDefault: scored ? Number(pd.toFixed(4)) : null,
      riskBand: scored ? band.band : 'Not scored',
      riskCategory: riskCategoryFor(band.band),
      scored,
      interestRate,
      emi: Math.round(monthlyEmi),
      foir: foir === null ? null : Number(foir.toFixed(4)),
      existingFoir: existingFoir === null ? null : Number(existingFoir.toFixed(4)),
      foirLimit: FOIR_COMFORTABLE,
      ltv: ltv === null ? null : Number(ltv.toFixed(4)),
      ltvCap,
      eligibleAmount,
      age,
      ageAtMaturity: ageAtMaturity === null ? null : Number(ageAtMaturity.toFixed(1)),
      approvePd: product.approvePd,
      declinePd: product.declinePd,
    },
    model: ml.model,
  };
};

module.exports = { assessApplication, PAN_REGEX, namesMatch };
