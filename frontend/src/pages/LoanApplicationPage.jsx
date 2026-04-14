import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../api/client';
import AppShell from '../components/AppShell';
import FormField from '../components/FormField';
import SectionHeading from '../components/SectionHeading';
import { useAuth } from '../context/AuthContext';

const initialValues = {
  name: '',
  dateOfBirth: '',
  phone: '',
  address: '',
  income: '',
  creditScore: '',
  assets: '',
  liabilities: '',
  employment: 'employed',
  employerName: '',
  jobTitle: '',
  yearsEmployed: '',
  loanAmount: '',
  purpose: '',
  tenureMonths: '',
};

const LoanApplicationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const progress = useMemo(() => {
    const total = Object.keys(initialValues).length;
    const filled = Object.entries(values).filter(([, value]) => String(value).trim()).length;
    return Math.round((filled / total) * 100);
  }, [values]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const validate = () => {
    const nextErrors = {};

    if (!values.name.trim()) nextErrors.name = 'Full name is required';
    if (!values.phone.trim()) nextErrors.phone = 'Phone number is required';
    if (!values.income || Number(values.income) <= 0) nextErrors.income = 'Income must be greater than 0';
    if (!values.creditScore || Number(values.creditScore) < 300) nextErrors.creditScore = 'Credit score must be between 300 and 850';
    if (!values.loanAmount || Number(values.loanAmount) <= 0) nextErrors.loanAmount = 'Loan amount must be greater than 0';
    if (!values.tenureMonths || Number(values.tenureMonths) <= 0) nextErrors.tenureMonths = 'Loan tenure is required';

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const payload = {
        income: Number(values.income),
        creditScore: Number(values.creditScore),
        loanAmount: Number(values.loanAmount),
        employment: values.employment,
        personalInfo: {
          name: values.name,
          dateOfBirth: values.dateOfBirth,
          phone: values.phone,
          address: values.address,
        },
        financialInfo: {
          assets: values.assets,
          liabilities: values.liabilities,
        },
        employmentInfo: {
          employerName: values.employerName,
          jobTitle: values.jobTitle,
          yearsEmployed: values.yearsEmployed,
        },
        loanDetails: {
          purpose: values.purpose,
          tenureMonths: values.tenureMonths,
        },
      };

      const { data } = await api.post('/apply-loan', payload);
      const resultPayload = { loan: data.loan, prediction: data.prediction };
      localStorage.setItem('securelend:lastResult', JSON.stringify(resultPayload));
      navigate('/result', { state: resultPayload });
    } catch (error) {
      setErrors({ form: error.response?.data?.message || 'Unable to submit loan application' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Loan Application"
      subtitle="Submit your financial details and let the ML service estimate fraud risk before the application enters review."
      actions={
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-500/30 bg-neon-500/10 px-4 py-2 text-sm text-neon-500">
          <ShieldCheck className="h-4 w-4" />{user?.role === 'admin' ? 'Admin preview mode' : 'User application'}
        </div>
      }
    >
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>Application completion</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-neon-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {errors.form ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{errors.form}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SectionHeading eyebrow="Section 1" title="Personal info" subtitle="Identify the applicant and contact details." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FormField label="Full name" error={errors.name}>
              <input name="name" value={values.name} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
            <FormField label="Date of birth">
              <input type="date" name="dateOfBirth" value={values.dateOfBirth} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
            <FormField label="Phone" error={errors.phone}>
              <input name="phone" value={values.phone} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
            <FormField label="Address">
              <input name="address" value={values.address} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SectionHeading eyebrow="Section 2" title="Financial info" subtitle="Provide the current financial picture used by the scoring model." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FormField label="Annual income" error={errors.income} hint="Gross annual income">
              <input type="number" name="income" value={values.income} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
            <FormField label="Credit score" error={errors.creditScore} hint="300 to 850">
              <input type="number" name="creditScore" value={values.creditScore} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
            <FormField label="Assets">
              <input name="assets" value={values.assets} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
            <FormField label="Liabilities">
              <input name="liabilities" value={values.liabilities} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SectionHeading eyebrow="Section 3" title="Employment" subtitle="Employment stability is one of the strongest fraud signals." />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <FormField label="Employment status">
              <select name="employment" value={values.employment} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60">
                <option value="employed">Employed</option>
                <option value="self_employed">Self employed</option>
                <option value="contract">Contract</option>
                <option value="unemployed">Unemployed</option>
              </select>
            </FormField>
            <FormField label="Employer name">
              <input name="employerName" value={values.employerName} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
            <FormField label="Job title">
              <input name="jobTitle" value={values.jobTitle} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
            <FormField label="Years employed">
              <input type="number" name="yearsEmployed" value={values.yearsEmployed} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SectionHeading eyebrow="Section 4" title="Loan details" subtitle="Define the requested loan amount and purpose." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FormField label="Loan amount" error={errors.loanAmount}>
              <input type="number" name="loanAmount" value={values.loanAmount} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
            <FormField label="Tenure months" error={errors.tenureMonths}>
              <input type="number" name="tenureMonths" value={values.tenureMonths} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Purpose">
                <textarea name="purpose" value={values.purpose} onChange={handleChange} rows="4" className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none focus:border-neon-500/60" />
              </FormField>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-neon-500 px-6 py-3 font-semibold text-black transition hover:bg-neon-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Run risk analysis'} <ArrowRight className="h-4 w-4" />
          </motion.button>
        </div>
      </form>
    </AppShell>
  );
};

export default LoanApplicationPage;
