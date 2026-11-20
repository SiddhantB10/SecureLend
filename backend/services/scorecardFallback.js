/**
 * Logistic-regression scorecard used when the ML service is unreachable.
 * The coefficients are exported by ml-service/training/train_model.py into backend/ml/scorecard.json,
 * so this fallback is trained on the same real loan outcomes as the main model.
 */
const path = require('path');
const fs = require('fs');
const { riskBandFor } = require('./lendingPolicy');

const SCORECARD_PATH = path.join(__dirname, '..', 'ml', 'scorecard.json');

let scorecard = null;
const loadScorecard = () => {
  if (!scorecard) {
    scorecard = JSON.parse(fs.readFileSync(SCORECARD_PATH, 'utf8'));
  }
  return scorecard;
};

const LABELS = {
  credit_score: 'Credit score',
  existing_debt_to_income: 'Existing EMIs vs income',
  tenure_months: 'Loan tenure',
  credit_applications_6m: 'Recent credit applications',
  residence: 'Residence type',
  purpose: 'Loan purpose',
};

const cibilToFico = (cibil) => 300 + (Math.min(Math.max(Number(cibil), 300), 900) - 300) * (550 / 600);

const buildFeatures = (input) => {
  const income = Math.max(Number(input.monthlyIncome) || 0, 1);
  const residence = input.residenceType === 'family' ? 'rented' : input.residenceType || 'rented';
  return {
    credit_score: cibilToFico(input.creditScore ?? 650),
    existing_debt_to_income: Math.min(((Number(input.existingEmi) || 0) / income) * 100, 100),
    tenure_months: Math.min(Math.max(Number(input.tenureMonths) || 36, 36), 60),
    credit_applications_6m: Math.min(Math.max(Number(input.recentCreditApplications) || 0, 0), 10),
    residence,
    purpose: input.purpose || 'other',
  };
};

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

const logOdds = (card, features) => {
  let z = card.intercept;
  for (const term of card.numeric) {
    const raw = Number.isFinite(features[term.name]) ? features[term.name] : term.median;
    z += term.coef * ((raw - term.mean) / term.scale);
  }
  for (const [name, coefs] of Object.entries(card.categorical)) {
    z += coefs[features[name]] ?? 0;
  }
  return z;
};

/** Returns the same shape as the ML service's /predict response. */
const scoreWithFallback = (input) => {
  const all = loadScorecard();
  const loanType = input.loanType === 'property' ? 'property' : 'personal';
  const card = all[loanType];
  const features = buildFeatures(input);
  const pd = sigmoid(logOdds(card, features));

  // Impact of each input = PD change if that input were at the training-population average.
  const contributions = [];
  for (const term of card.numeric) {
    const neutral = { ...features, [term.name]: term.mean };
    const impact = pd - sigmoid(logOdds(card, neutral));
    contributions.push({ feature: term.name, label: LABELS[term.name] || term.name, impact: Number(impact.toFixed(4)) });
  }
  contributions.forEach((c) => {
    c.direction = c.impact > 0.002 ? 'increases_risk' : c.impact < -0.002 ? 'decreases_risk' : 'neutral';
  });
  contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    loanType,
    probabilityOfDefault: Number(pd.toFixed(4)),
    riskBand: riskBandFor(pd).band,
    contributions,
    anomaly: { isAnomalous: false, score: null },
    model: { name: 'logistic_scorecard_fallback', version: all.modelVersion, rocAuc: null, trainedOn: 'Lending Club personal loans 2007-2011' },
  };
};

module.exports = { scoreWithFallback };
