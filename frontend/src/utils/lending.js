// Mirrors backend/services/lendingPolicy.js so the form can show a live, indicative preview.
// The backend is always the source of truth for the actual decision.

export const LAKH = 100000;

export const PRODUCTS = {
  personal: { label: 'Personal loan', minAmount: 50000, maxAmount: 40 * LAKH, minTenure: 12, maxTenure: 60, baseRate: 10.5, minMonthlyIncome: 15000 },
  property: { label: 'Property loan', minAmount: 5 * LAKH, maxAmount: 1000 * LAKH, minTenure: 60, maxTenure: 360, baseRate: 8.5, minMonthlyIncome: 25000 },
};

export const FOIR_COMFORTABLE = 0.5;
export const FOIR_MAX = 0.6;

export const PURPOSES = [
  { value: 'debt_consolidation', label: 'Consolidate existing debt / credit cards' },
  { value: 'home_renovation', label: 'Home renovation' },
  { value: 'medical', label: 'Medical expenses' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'education', label: 'Education' },
  { value: 'vehicle', label: 'Vehicle purchase' },
  { value: 'business', label: 'Business needs' },
  { value: 'travel', label: 'Travel' },
  { value: 'major_purchase', label: 'Large purchase (appliances, electronics)' },
  { value: 'other', label: 'Other' },
];

export const EMPLOYMENT_TYPES = [
  { value: 'salaried', label: 'Salaried' },
  { value: 'self_employed', label: 'Self-employed (business / professional)' },
  { value: 'retired', label: 'Retired (pension income)' },
  { value: 'unemployed', label: 'Not currently earning' },
];

export const RESIDENCE_TYPES = [
  { value: 'rented', label: 'Rented' },
  { value: 'owned', label: 'Own house (no home loan)' },
  { value: 'owned_mortgage', label: 'Own house (with home loan)' },
  { value: 'family', label: 'Living with family' },
];

export const labelFor = (options, value) => options.find((o) => o.value === value)?.label || value || '—';

export const emi = (principal, annualRatePct, months) => {
  if (!(principal > 0) || !(months > 0)) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const f = (1 + r) ** months;
  return (principal * r * f) / (f - 1);
};

export const ltvCapFor = (loanAmount) => (loanAmount <= 30 * LAKH ? 0.9 : loanAmount <= 75 * LAKH ? 0.8 : 0.75);

export const ageFrom = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
};

export const formatPct = (value, digits = 0) => (value === null || value === undefined ? '—' : `${(Number(value) * 100).toFixed(digits)}%`);
