import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Mail, Phone, ArrowRight, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const indianPhoneRegex = /^(?:\+91[-\s]?)?[6-9]\d{9}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── OTP Input (6 boxes) ─────────────────────────────────────────────────────
const OtpInput = ({ value, onChange, hasError }) => {
  const inputs = useRef([]);

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleChange = (e, idx) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[idx] = digit;
    const next = arr.join('');
    onChange(next);
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) onChange(pasted);
    e.preventDefault();
  };

  return (
    <div className="flex gap-2">
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => (inputs.current[idx] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[idx] || ''}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          onPaste={handlePaste}
          className={`h-12 w-10 rounded-xl border text-center text-lg font-semibold outline-none transition focus:ring-2 focus:ring-neon-500 ${
            hasError
              ? 'border-red-400 bg-red-50 text-red-700'
              : 'border-gray-300 bg-white text-gray-900'
          }`}
        />
      ))}
    </div>
  );
};

// ─── Countdown Timer ─────────────────────────────────────────────────────────
const useCountdown = (seconds) => {
  const [remaining, setRemaining] = useState(0);

  const start = () => setRemaining(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  return { remaining, start };
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SignupPage = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();

  // Step 1: collect details
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [formErrors, setFormErrors] = useState({});

  // Step 2: OTP verification
  const [step, setStep] = useState(1); // 1 = details, 2 = otp
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [otpErrors, setOtpErrors] = useState({});
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [smsFailed, setSmsFailed] = useState(false); // true when SMS couldn't be delivered

  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null); // { type: 'error'|'info', text }

  const { remaining: resendCooldown, start: startCooldown } = useCountdown(60);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  // ── Step 1: Validate & Send OTP ──────────────────────────────────────────
  const validateDetails = () => {
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!emailRegex.test(form.email.trim())) errs.email = 'Enter a valid email address';
    if (!indianPhoneRegex.test(form.phone.trim())) errs.phone = 'Enter a valid Indian phone number';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    return errs;
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    const errs = validateDetails();
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setBanner(null);
    try {
      const { data } = await api.post('/auth/send-otp', { email: form.email.trim(), phone: form.phone.trim() });
      setStep(2);
      startCooldown();
      setSmsFailed(!!data.smsFailed);
      if (data.emailFailed) {
        setBanner({ type: 'info', text: data.message });
      } else if (data.smsFailed) {
        setBanner({ type: 'info', text: 'Email OTP sent ✓  SMS delivery failed — only email OTP is required to continue.' });
      } else {
        setBanner({ type: 'info', text: 'OTP sent to your email and phone. Check both!' });
      }
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || 'Failed to send OTP. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setEmailOtp('');
    setPhoneOtp('');
    setOtpErrors({});
    handleSendOtp();
  };

  // ── Step 2: Verify OTPs ──────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const errs = {};
    if (emailOtp.length !== 6) errs.emailOtp = 'Enter the 6-digit email OTP';
    if (!smsFailed && phoneOtp.length !== 6) errs.phoneOtp = 'Enter the 6-digit phone OTP';
    setOtpErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setBanner(null);
    try {
      const { data } = await api.post('/auth/verify-otp', {
        email: form.email.trim(),
        emailOtp,
        phoneOtp: smsFailed ? '' : phoneOtp,
      });
      setVerifiedToken(data.verifiedToken);
      // Auto-complete signup
      await handleSignup(data.verifiedToken);
    } catch (err) {
      const payload = err.response?.data;
      const invalid = payload?.invalidFields || [];
      const nextErrs = {};
      if (invalid.includes('emailOtp')) nextErrs.emailOtp = 'Incorrect email OTP';
      if (invalid.includes('phoneOtp')) nextErrs.phoneOtp = 'Incorrect phone OTP';
      setOtpErrors(nextErrs);
      setBanner({ type: 'error', text: payload?.message || 'Verification failed. Please check your OTPs.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Create account ───────────────────────────────────────────────
  const handleSignup = async (token) => {
    try {
      const response = await signup({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        verifiedToken: token,
      });
      navigate(response.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || 'Account creation failed. Please try again.' });
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <header className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.3em] text-neon-500">
          <ShieldCheck className="h-5 w-5" />SecureLend
        </Link>
      </header>

      <main className="flex-1 px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-[calc(100vh-10rem)] max-w-6xl place-items-center lg:grid-cols-2 lg:gap-12">
          {/* Left panel */}
          <div className="hidden lg:block">
            <p className="text-xs uppercase tracking-[0.35em] text-neon-500/80">Join SecureLend</p>
            <h1 className="mt-4 max-w-lg text-5xl font-semibold leading-tight text-gray-900">
              Create your account and start your loan application online.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">
              We verify your email and phone to keep your account secure.
            </p>

            {/* Step indicators */}
            <div className="mt-10 flex flex-col gap-4">
              {[
                { n: 1, label: 'Enter your details', icon: <ShieldCheck className="h-5 w-5" /> },
                { n: 2, label: 'Verify email & phone OTP', icon: <Mail className="h-5 w-5" /> },
                { n: 3, label: 'Account created', icon: <CheckCircle2 className="h-5 w-5" /> },
              ].map(({ n, label, icon }) => (
                <div key={n} className={`flex items-center gap-3 ${step >= n ? 'text-neon-500' : 'text-gray-400'}`}>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step >= n ? 'border-neon-500 bg-neon-500/10' : 'border-gray-300'}`}>
                    <span className="text-xs font-bold">{n}</span>
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="w-full max-w-md">
            {/* Banner */}
            {banner && (
              <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                banner.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700'
              }`}>
                {banner.text}
              </div>
            )}

            {/* ── Step 1: Details ── */}
            {step === 1 && (
              <form onSubmit={handleSendOtp} className="flex flex-col gap-5">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Create account</h2>
                  <p className="mt-1 text-sm text-gray-500">We'll send OTPs to verify your email and phone.</p>
                </div>

                {[
                  { name: 'name', label: 'Full name', type: 'text', placeholder: 'Your full name' },
                  { name: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com' },
                  { name: 'phone', label: 'Phone number', type: 'tel', placeholder: '9876543210' },
                  { name: 'password', label: 'Password', type: 'password', placeholder: 'Min 8 characters' },
                ].map(({ name, label, type, placeholder }) => (
                  <div key={name}>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                      {label}
                    </label>
                    <input
                      name={name}
                      type={type}
                      value={form[name]}
                      onChange={handleChange}
                      placeholder={placeholder}
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-neon-500 ${
                        formErrors[name] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50'
                      }`}
                    />
                    {formErrors[name] && (
                      <p className="mt-1 text-xs text-red-500">{formErrors[name]}</p>
                    )}
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-full bg-neon-500 px-6 py-3 font-semibold text-white transition hover:bg-neon-400 disabled:opacity-60"
                >
                  {loading ? 'Sending OTPs…' : <>Send verification OTPs <ArrowRight className="h-4 w-4" /></>}
                </button>

                <p className="text-center text-sm text-gray-500">
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold text-neon-500 hover:underline">Log in</Link>
                </p>
              </form>
            )}

            {/* ── Step 2: OTP Verification ── */}
            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Verify your identity</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {smsFailed ? (
                      <>Enter the 6-digit code sent to <strong>{form.email}</strong>.</>
                    ) : (
                      <>Enter the 6-digit codes sent to <strong>{form.email}</strong> and <strong>{form.phone}</strong>.</>
                    )}
                  </p>
                </div>

                {/* Email OTP */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-600">
                    <Mail className="h-4 w-4" /> Email OTP
                  </label>
                  <OtpInput value={emailOtp} onChange={setEmailOtp} hasError={!!otpErrors.emailOtp} />
                  {otpErrors.emailOtp && <p className="mt-1 text-xs text-red-500">{otpErrors.emailOtp}</p>}
                </div>

                {/* Phone OTP */}
                {!smsFailed && (
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-600">
                      <Phone className="h-4 w-4" /> Phone OTP
                    </label>
                    <OtpInput value={phoneOtp} onChange={setPhoneOtp} hasError={!!otpErrors.phoneOtp} />
                    {otpErrors.phoneOtp && <p className="mt-1 text-xs text-red-500">{otpErrors.phoneOtp}</p>}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-full bg-neon-500 px-6 py-3 font-semibold text-white transition hover:bg-neon-400 disabled:opacity-60"
                >
                  {loading ? 'Verifying…' : <>Verify & Create Account <CheckCircle2 className="h-4 w-4" /></>}
                </button>

                {/* Resend */}
                <div className="text-center text-sm text-gray-500">
                  Didn't receive the codes?{' '}
                  {resendCooldown > 0 ? (
                    <span className="font-semibold text-gray-400">Resend in {resendCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="inline-flex items-center gap-1 font-semibold text-neon-500 hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Resend OTPs
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => { setStep(1); setBanner(null); }}
                  className="text-center text-xs text-gray-400 hover:text-gray-600"
                >
                  ← Back to details
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SignupPage;
