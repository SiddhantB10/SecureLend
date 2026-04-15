import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../api/client';
import AppShell from '../components/AppShell';
import FormField from '../components/FormField';
import LenderDatePicker from '../components/LenderDatePicker';
import LenderSelect from '../components/LenderSelect';
import SectionHeading from '../components/SectionHeading';
import { useAuth } from '../context/AuthContext';

const initialValues = {
  loanType: 'personal',
  name: '',
  dateOfBirth: '',
  phone: '',
  address: '',
  income: '',
  creditScore: '',
  existingDebt: '',
  propertyValue: '',
  assets: '',
  liabilities: '',
  employmentStatus: 'stable',
  employerName: '',
  jobTitle: '',
  yearsEmployed: '',
  loanAmount: '',
  purpose: '',
  tenureMonths: '',
};

const indianPhoneRegex = /^(?:\+91[-\s]?)?[6-9]\d{9}$/;
const controlClass = 'secure-form-control';
const textareaClass = 'secure-textarea';

const LoanApplicationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const progress = useMemo(() => {
    const activeKeys = Object.keys(initialValues).filter((key) => (values.loanType === 'property' ? true : key !== 'propertyValue'));
    const total = activeKeys.length;
    const filled = activeKeys.filter((key) => String(values[key]).trim()).length;
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
    else if (!indianPhoneRegex.test(values.phone.trim())) nextErrors.phone = 'Enter a valid Indian phone number';
    if (!values.income || Number(values.income) <= 0) nextErrors.income = 'Annual income in INR must be greater than 0';
    if (!values.creditScore || Number(values.creditScore) < 300 || Number(values.creditScore) > 900) {
      nextErrors.creditScore = 'Credit score must be between 300 and 900';
    }
    if (values.existingDebt === '' || Number(values.existingDebt) < 0) {
      nextErrors.existingDebt = 'Existing debt in INR must be 0 or greater';
    }
    if (!values.loanAmount || Number(values.loanAmount) <= 0) nextErrors.loanAmount = 'Loan amount in INR must be greater than 0';
    if (!values.tenureMonths || Number(values.tenureMonths) <= 0) nextErrors.tenureMonths = 'Loan tenure is required';
    if (values.loanType === 'property' && (!values.propertyValue || Number(values.propertyValue) <= 0)) {
      nextErrors.propertyValue = 'Property value in INR is required for property loans';
    }
    if (values.loanType === 'personal' && !values.employmentStatus) {
      nextErrors.employmentStatus = 'Employment status is required for personal loans';
    }

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
        loanType: values.loanType,
        income: Number(values.income),
        creditScore: Number(values.creditScore),
        loanAmount: Number(values.loanAmount),
        existingDebt: Number(values.existingDebt),
        propertyValue: values.loanType === 'property' ? Number(values.propertyValue) : 0,
        employmentStatus: values.loanType === 'personal' ? values.employmentStatus : 'stable',
        employment: values.loanType === 'personal' ? values.employmentStatus : 'stable',
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
      subtitle="Choose your loan type, provide your details in INR, and submit your application for review."
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
          <SectionHeading
            eyebrow="Loan selection"
            title="Pick loan type"
            subtitle="Select the loan category that matches your borrowing requirement."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FormField label="Loan type">
              <LenderSelect
                name="loanType"
                value={values.loanType}
                onChange={handleChange}
                options={[
                  { value: 'personal', label: 'Personal Loan (unsecured)' },
                  { value: 'property', label: 'Property Loan (secured)' },
                ]}
                placeholder="Select loan type"
              />
            </FormField>
            {values.loanType === 'property' ? (
              <FormField label="Property value (INR)" error={errors.propertyValue} hint="Required for Property Loan">
                <input type="number" name="propertyValue" value={values.propertyValue} onChange={handleChange} className={controlClass} />
              </FormField>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SectionHeading eyebrow="Section 1" title="Personal info" subtitle="Identify the applicant and contact details." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FormField label="Full name" error={errors.name}>
              <input name="name" value={values.name} onChange={handleChange} className={controlClass} />
            </FormField>
            <FormField label="Date of birth">
              <LenderDatePicker name="dateOfBirth" value={values.dateOfBirth} onChange={handleChange} />
            </FormField>
            <FormField label="Phone" error={errors.phone}>
              <input name="phone" value={values.phone} onChange={handleChange} placeholder="+91 98XXXXXXXX" className={controlClass} />
            </FormField>
            <FormField label="Address">
              <input name="address" value={values.address} onChange={handleChange} className={controlClass} />
            </FormField>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SectionHeading eyebrow="Section 2" title="Financial info" subtitle="Provide your current income, liabilities, and repayment-related details." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FormField label="Annual income (INR)" error={errors.income} hint="Gross annual income in Indian Rupees">
              <input type="number" name="income" value={values.income} onChange={handleChange} className={controlClass} />
            </FormField>
            <FormField label="Credit score" error={errors.creditScore} hint="300 to 900">
              <input type="number" name="creditScore" value={values.creditScore} onChange={handleChange} className={controlClass} />
            </FormField>
            <FormField label="Existing debt (INR)" error={errors.existingDebt} hint="Total current outstanding debt">
              <input type="number" name="existingDebt" value={values.existingDebt} onChange={handleChange} className={controlClass} />
            </FormField>
            <FormField label="Assets (INR)">
              <input name="assets" value={values.assets} onChange={handleChange} className={controlClass} />
            </FormField>
            <FormField label="Liabilities (INR)">
              <input name="liabilities" value={values.liabilities} onChange={handleChange} className={controlClass} />
            </FormField>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SectionHeading eyebrow="Section 3" title="Employment" subtitle="Share your work details to support profile verification and loan assessment." />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {values.loanType === 'personal' ? (
              <FormField label="Employment status" error={errors.employmentStatus}>
                <LenderSelect
                  name="employmentStatus"
                  value={values.employmentStatus}
                  onChange={handleChange}
                  options={[
                    { value: 'stable', label: 'Stable' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'unstable', label: 'Unstable' },
                  ]}
                  placeholder="Select employment status"
                />
              </FormField>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/60 md:col-span-3">
                Employment status is optional for property-backed applications.
              </div>
            )}
            <FormField label="Employer name">
              <input name="employerName" value={values.employerName} onChange={handleChange} className={controlClass} />
            </FormField>
            <FormField label="Job title">
              <input name="jobTitle" value={values.jobTitle} onChange={handleChange} className={controlClass} />
            </FormField>
            <FormField label="Years employed">
              <input type="number" name="yearsEmployed" value={values.yearsEmployed} onChange={handleChange} className={controlClass} />
            </FormField>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SectionHeading eyebrow="Section 4" title="Loan details" subtitle="Define the requested loan amount in INR and purpose." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FormField label="Loan amount (INR)" error={errors.loanAmount}>
              <input type="number" name="loanAmount" value={values.loanAmount} onChange={handleChange} className={controlClass} />
            </FormField>
            <FormField label="Tenure months" error={errors.tenureMonths}>
              <input type="number" name="tenureMonths" value={values.tenureMonths} onChange={handleChange} className={controlClass} />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Purpose">
                <textarea name="purpose" value={values.purpose} onChange={handleChange} rows="4" className={textareaClass} />
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
            {submitting ? 'Submitting...' : 'Submit application'} <ArrowRight className="h-4 w-4" />
          </motion.button>
        </div>
      </form>
    </AppShell>
  );
};

export default LoanApplicationPage;
