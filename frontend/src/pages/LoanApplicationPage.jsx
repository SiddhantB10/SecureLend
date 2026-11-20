import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, Calculator, Info, ShieldCheck, Wallet } from 'lucide-react';
import api from '../api/client';
import AppShell from '../components/AppShell';
import FormField from '../components/FormField';
import LenderDatePicker from '../components/LenderDatePicker';
import LenderSelect from '../components/LenderSelect';
import SectionHeading from '../components/SectionHeading';
import { useAuth } from '../context/AuthContext';
import { formatInr } from '../utils/formatters';
import {
  EMPLOYMENT_TYPES,
  FOIR_COMFORTABLE,
  FOIR_MAX,
  PRODUCTS,
  PURPOSES,
  RESIDENCE_TYPES,
  ageFrom,
  emi,
  formatPct,
  ltvCapFor,
} from '../utils/lending';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const controlClass = 'secure-form-control';

const initialValues = (user) => ({
  loanType: 'personal',
  loanAmount: '',
  tenureMonths: '36',
  purpose: '',
  propertyValue: '',
  fullName: user?.name || '',
  dateOfBirth: '',
  pan: '',
  employmentType: 'salaried',
  monthlyIncome: '',
  yearsEmployed: '',
  residenceType: 'rented',
  existingEmi: '0',
  noCreditHistory: false,
  creditScore: '',
  missedPayments: '0',
  recentCreditApplications: '0',
  creditHistoryYears: '',
  consent: false,
});

const NumberInput = ({ name, value, onChange, placeholder, step = 'any', min = 0, prefix }) => (
  <div className="relative">
    {prefix ? <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">{prefix}</span> : null}
    <input
      type="number"
      inputMode="decimal"
      name={name}
      value={value}
      min={min}
      step={step}
      onChange={onChange}
      placeholder={placeholder}
      className={controlClass}
      style={prefix ? { paddingLeft: '2.25rem' } : undefined}
    />
  </div>
);

const Meter = ({ label, value, comfortable, max, valueLabel, note }) => {
  const percent = Math.min(100, Math.max(0, (value / (max * 1.25)) * 100));
  const tone = value > max ? 'bg-red-500' : value > comfortable ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{valueLabel}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${percent}%` }} />
      </div>
      {note ? <p className="mt-1 text-xs text-gray-500">{note}</p> : null}
    </div>
  );
};

const LoanApplicationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [values, setValues] = useState(() => initialValues(user));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const product = PRODUCTS[values.loanType];
  const isProperty = values.loanType === 'property';
  const showYears = values.employmentType === 'salaried' || values.employmentType === 'self_employed';

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setValues((current) => {
      const next = { ...current, [name]: type === 'checkbox' ? checked : name === 'pan' ? value.toUpperCase().slice(0, 10) : value };
      if (name === 'loanType') {
        next.tenureMonths = value === 'property' ? '240' : '36';
      }
      return next;
    });
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  // Live, indicative affordability preview (final rate depends on the risk assessment).
  const preview = useMemo(() => {
    const amount = Number(values.loanAmount);
    const tenure = Number(values.tenureMonths);
    const income = Number(values.monthlyIncome);
    const existing = Number(values.existingEmi) || 0;
    const rateFrom = product.baseRate;
    const emiFrom = emi(amount, rateFrom, tenure);
    const emiTypical = emi(amount, rateFrom + 2.5, tenure);
    const foir = income > 0 && emiTypical > 0 ? (existing + emiTypical) / income : null;
    const propertyValue = Number(values.propertyValue);
    const ltv = isProperty && propertyValue > 0 && amount > 0 ? amount / propertyValue : null;
    const age = ageFrom(values.dateOfBirth);
    return {
      emiFrom,
      emiTypical,
      rateFrom,
      foir,
      ltv,
      ltvCap: amount > 0 ? ltvCapFor(amount) : null,
      ageAtMaturity: age !== null && tenure > 0 ? age + tenure / 12 : null,
    };
  }, [values, product, isProperty]);

  const validate = () => {
    const e = {};
    const amount = Number(values.loanAmount);
    const tenure = Number(values.tenureMonths);
    if (!(amount >= product.minAmount && amount <= product.maxAmount)) {
      e.loanAmount = `Enter an amount between ${formatInr(product.minAmount)} and ${formatInr(product.maxAmount)}`;
    }
    if (!(Number.isInteger(tenure) && tenure >= product.minTenure && tenure <= product.maxTenure)) {
      e.tenureMonths = `Tenure must be ${product.minTenure}–${product.maxTenure} months`;
    }
    if (!isProperty && !values.purpose) e.purpose = 'Select the purpose of the loan';
    if (isProperty && !(Number(values.propertyValue) >= 100000)) e.propertyValue = 'Enter the market value of the property';

    if (values.fullName.trim().length < 3) e.fullName = 'Enter your full name as on your PAN card';
    const age = ageFrom(values.dateOfBirth);
    if (age === null) e.dateOfBirth = 'Select your date of birth';
    else if (age < 18 || age > 100) e.dateOfBirth = 'Enter a valid date of birth';
    if (!PAN_REGEX.test(values.pan)) e.pan = 'PAN must look like ABCDE1234F';

    if (values.monthlyIncome === '' || Number(values.monthlyIncome) < 0) e.monthlyIncome = 'Enter your net monthly income (take-home)';
    if (showYears && (values.yearsEmployed === '' || Number(values.yearsEmployed) < 0)) e.yearsEmployed = 'Enter years in your current job or business';
    if (values.existingEmi === '' || Number(values.existingEmi) < 0) e.existingEmi = 'Enter 0 if you have no EMIs';

    if (!values.noCreditHistory) {
      const score = Number(values.creditScore);
      if (!(Number.isInteger(score) && score >= 300 && score <= 900)) e.creditScore = 'Enter your CIBIL score (300–900)';
      if (values.missedPayments === '' || Number(values.missedPayments) < 0) e.missedPayments = 'Enter 0 if none';
      if (values.recentCreditApplications === '' || Number(values.recentCreditApplications) < 0) e.recentCreditApplications = 'Enter 0 if none';
      if (values.creditHistoryYears === '' || Number(values.creditHistoryYears) < 0) e.creditHistoryYears = 'Enter years since your first loan or credit card';
    }
    if (!values.consent) e.consent = 'Please confirm to continue';
    return e;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        loanType: values.loanType,
        loanAmount: Number(values.loanAmount),
        tenureMonths: Number(values.tenureMonths),
        ...(isProperty ? { propertyValue: Number(values.propertyValue) } : { purpose: values.purpose }),
        fullName: values.fullName.trim(),
        dateOfBirth: values.dateOfBirth,
        pan: values.pan,
        employmentType: values.employmentType,
        monthlyIncome: Number(values.monthlyIncome),
        ...(showYears ? { yearsEmployed: Number(values.yearsEmployed) } : {}),
        existingEmi: Number(values.existingEmi) || 0,
        residenceType: values.residenceType,
        noCreditHistory: values.noCreditHistory,
        ...(values.noCreditHistory
          ? {}
          : {
              creditScore: Number(values.creditScore),
              missedPayments: Number(values.missedPayments),
              recentCreditApplications: Number(values.recentCreditApplications),
              creditHistoryYears: Number(values.creditHistoryYears),
            }),
      };

      const { data } = await api.post('/apply-loan', payload);
      localStorage.setItem('securelend:lastResult', JSON.stringify({ loan: data.loan }));
      navigate(`/result/${data.loan._id}`, { state: { loan: data.loan } });
    } catch (error) {
      const serverErrors = error.response?.data?.errors;
      if (Array.isArray(serverErrors)) {
        setErrors(Object.fromEntries(serverErrors.map((item) => [item.field, item.message])));
      }
      setErrors((current) => ({ ...current, form: error.response?.data?.message || 'Unable to submit loan application' }));
    } finally {
      setSubmitting(false);
    }
  };

  const err = (name) => (errors[name] ? { 'data-error': 'true' } : {});

  return (
    <AppShell
      title="Apply for a loan"
      subtitle="Takes about 3 minutes. We only ask for what is needed to assess your eligibility; your decision and the reasons behind it are shown instantly."
      actions={
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-500/30 bg-neon-500/10 px-4 py-2 text-sm text-neon-500">
          <ShieldCheck className="h-4 w-4" />Your PAN is never stored in full
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="grid gap-8 xl:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          {errors.form ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{errors.form}</div> : null}

          {/* 1. Loan */}
          <section className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
            <SectionHeading eyebrow="Step 1" title="What do you need?" />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { value: 'personal', icon: Wallet, title: 'Personal loan', text: `Unsecured · ₹50,000 – ₹40 lakh · 12–60 months` },
                { value: 'property', icon: Building2, title: 'Property loan', text: 'Secured against property · up to 90% of value · 5–30 years' },
              ].map(({ value, icon: Icon, title, text }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleChange({ target: { name: 'loanType', value } })}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    values.loanType === value ? 'border-neon-500 bg-neon-500/10 ring-1 ring-neon-500' : 'border-gray-300 bg-white hover:border-neon-500/50'
                  }`}
                >
                  <Icon className="mt-0.5 h-5 w-5 text-neon-500" />
                  <span>
                    <span className="block font-semibold text-gray-900">{title}</span>
                    <span className="block text-xs text-gray-600">{text}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div {...err('loanAmount')}>
                <FormField label="Loan amount" error={errors.loanAmount} hint={`${formatInr(product.minAmount)} – ${formatInr(product.maxAmount)}`}>
                  <NumberInput name="loanAmount" value={values.loanAmount} onChange={handleChange} prefix="₹" step="1000" placeholder="5,00,000" />
                </FormField>
              </div>
              <div {...err('tenureMonths')}>
                <FormField label="Tenure (months)" error={errors.tenureMonths} hint={`${product.minTenure}–${product.maxTenure} months${isProperty ? ` (${Number(values.tenureMonths || 0) / 12} years)` : ''}`}>
                  <NumberInput name="tenureMonths" value={values.tenureMonths} onChange={handleChange} step="1" />
                </FormField>
              </div>
              {isProperty ? (
                <div {...err('propertyValue')}>
                  <FormField label="Property market value" error={errors.propertyValue} hint="Agreement value or current market value">
                    <NumberInput name="propertyValue" value={values.propertyValue} onChange={handleChange} prefix="₹" step="10000" />
                  </FormField>
                </div>
              ) : (
                <div {...err('purpose')}>
                  <FormField label="Purpose" error={errors.purpose}>
                    <LenderSelect name="purpose" value={values.purpose} onChange={handleChange} options={PURPOSES} placeholder="Select purpose" />
                  </FormField>
                </div>
              )}
            </div>
          </section>

          {/* 2. Identity */}
          <section className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
            <SectionHeading eyebrow="Step 2" title="About you" subtitle="Used to verify your identity (KYC) and age eligibility." />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div {...err('fullName')}>
                <FormField label="Full name (as on PAN)" error={errors.fullName}>
                  <input name="fullName" value={values.fullName} onChange={handleChange} autoComplete="name" className={controlClass} />
                </FormField>
              </div>
              <div {...err('dateOfBirth')}>
                <FormField label="Date of birth" error={errors.dateOfBirth}>
                  <LenderDatePicker name="dateOfBirth" value={values.dateOfBirth} onChange={handleChange} />
                </FormField>
              </div>
              <div {...err('pan')}>
                <FormField label="PAN" error={errors.pan} hint="10 characters, e.g. ABCDE1234F">
                  <input name="pan" value={values.pan} onChange={handleChange} autoComplete="off" spellCheck="false" className={`${controlClass} font-mono uppercase tracking-widest`} placeholder="ABCDE1234F" />
                </FormField>
              </div>
            </div>
          </section>

          {/* 3. Income */}
          <section className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
            <SectionHeading eyebrow="Step 3" title="Income & existing EMIs" subtitle="Decides how much EMI you can comfortably afford." />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <FormField label="Employment type">
                <LenderSelect name="employmentType" value={values.employmentType} onChange={handleChange} options={EMPLOYMENT_TYPES} />
              </FormField>
              <div {...err('monthlyIncome')}>
                <FormField label="Net monthly income" error={errors.monthlyIncome} hint="Take-home salary, business income or pension per month">
                  <NumberInput name="monthlyIncome" value={values.monthlyIncome} onChange={handleChange} prefix="₹" step="1000" />
                </FormField>
              </div>
              {showYears ? (
                <div {...err('yearsEmployed')}>
                  <FormField label={values.employmentType === 'self_employed' ? 'Years in current business' : 'Years in current job'} error={errors.yearsEmployed}>
                    <NumberInput name="yearsEmployed" value={values.yearsEmployed} onChange={handleChange} step="0.5" />
                  </FormField>
                </div>
              ) : null}
              <div {...err('existingEmi')}>
                <FormField label="Existing EMIs per month" error={errors.existingEmi} hint="Total of all current loan EMIs (enter 0 if none)">
                  <NumberInput name="existingEmi" value={values.existingEmi} onChange={handleChange} prefix="₹" step="500" />
                </FormField>
              </div>
              <FormField label="Residence">
                <LenderSelect name="residenceType" value={values.residenceType} onChange={handleChange} options={RESIDENCE_TYPES} />
              </FormField>
            </div>
          </section>

          {/* 4. Credit */}
          <section className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
            <SectionHeading
              eyebrow="Step 4"
              title="Credit history"
              subtitle="These details are on your free CIBIL report (cibil.com, once a year). In production they are fetched directly from the credit bureau with your consent."
            />
            <label className="mt-6 flex items-center gap-3 text-sm text-gray-800">
              <input type="checkbox" name="noCreditHistory" checked={values.noCreditHistory} onChange={handleChange} className="h-4 w-4 accent-[#0066cc]" />
              I have never had a loan or credit card
            </label>
            {!values.noCreditHistory ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div {...err('creditScore')}>
                  <FormField label="CIBIL score" error={errors.creditScore} hint="300 – 900">
                    <NumberInput name="creditScore" value={values.creditScore} onChange={handleChange} step="1" min={300} />
                  </FormField>
                </div>
                <div {...err('creditHistoryYears')}>
                  <FormField label="Years since your first loan or credit card" error={errors.creditHistoryYears}>
                    <NumberInput name="creditHistoryYears" value={values.creditHistoryYears} onChange={handleChange} step="0.5" />
                  </FormField>
                </div>
                <div {...err('missedPayments')}>
                  <FormField label="Payments 30+ days late in the last 2 years" error={errors.missedPayments} hint="EMIs or card bills; 0 if none">
                    <NumberInput name="missedPayments" value={values.missedPayments} onChange={handleChange} step="1" />
                  </FormField>
                </div>
                <div {...err('recentCreditApplications')}>
                  <FormField label="Loan / card applications in the last 6 months" error={errors.recentCreditApplications} hint="Not counting this one">
                    <NumberInput name="recentCreditApplications" value={values.recentCreditApplications} onChange={handleChange} step="1" />
                  </FormField>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                No problem — first-time borrowers are assessed manually by a loan officer using your income documents.
              </p>
            )}
          </section>

          <div {...err('consent')} className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
            <label className="flex items-start gap-3 text-sm text-gray-800">
              <input type="checkbox" name="consent" checked={values.consent} onChange={handleChange} className="mt-0.5 h-4 w-4 accent-[#0066cc]" />
              <span>
                I confirm these details are true and authorise SecureLend to verify my identity, income and credit history with credit bureaus and KYC
                agencies for this application.
              </span>
            </label>
            {errors.consent ? <p className="mt-2 text-xs text-red-600">{errors.consent}</p> : null}
            <div className="mt-5 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-neon-500 px-6 py-3 font-semibold text-white transition hover:bg-neon-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Assessing your application…' : 'Check eligibility & apply'} <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-glow">
            <div className="flex items-center gap-2 text-neon-500">
              <Calculator className="h-5 w-5" />
              <p className="text-xs font-semibold uppercase tracking-[0.3em]">Live estimate</p>
            </div>
            <p className="mt-4 text-sm text-gray-600">Estimated EMI</p>
            <p className="text-3xl font-semibold text-gray-900">{preview.emiFrom ? formatInr(preview.emiFrom) : '—'}</p>
            <p className="text-xs text-gray-500">
              at {preview.rateFrom}% p.a. (best rate){preview.emiTypical ? ` · ${formatInr(preview.emiTypical)} at ${preview.rateFrom + 2.5}%` : ''}
            </p>

            <div className="mt-6 space-y-5">
              {preview.foir !== null ? (
                <Meter
                  label="EMIs as % of income (FOIR)"
                  value={preview.foir}
                  comfortable={FOIR_COMFORTABLE}
                  max={FOIR_MAX}
                  valueLabel={formatPct(preview.foir)}
                  note={preview.foir > FOIR_MAX ? 'Above 60% — likely to be declined. Try a smaller amount or longer tenure.' : preview.foir > FOIR_COMFORTABLE ? '50–60% needs manual review.' : 'Comfortable (50% or less).'}
                />
              ) : null}
              {preview.ltv !== null ? (
                <Meter
                  label="Loan-to-value (RBI cap)"
                  value={preview.ltv}
                  comfortable={preview.ltvCap - 0.05}
                  max={preview.ltvCap}
                  valueLabel={`${formatPct(preview.ltv)} / ${formatPct(preview.ltvCap)}`}
                  note={preview.ltv > preview.ltvCap ? `RBI allows at most ${formatPct(preview.ltvCap)} for this loan size.` : 'Within the RBI limit.'}
                />
              ) : null}
              {preview.ageAtMaturity !== null ? (
                <p className="text-sm text-gray-600">
                  Age when the loan ends: <span className="font-semibold text-gray-900">{Math.round(preview.ageAtMaturity)}</span>
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex gap-2 rounded-2xl bg-gray-50 p-3 text-xs leading-5 text-gray-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-neon-500" />
              Your final rate depends on your risk assessment. You will see exactly why your application was approved, sent for review or declined.
            </div>
          </div>
        </aside>
      </form>
    </AppShell>
  );
};

export default LoanApplicationPage;
