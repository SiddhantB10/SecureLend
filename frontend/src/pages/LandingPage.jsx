import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, BrainCircuit, Link2, BarChart3 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: BrainCircuit,
    title: 'Credit-risk model on real outcomes',
    text: 'A calibrated default-risk model trained on 42,000+ real loans with known repayment outcomes, plus RBI loan-to-value and FOIR affordability rules.',
  },
  {
    icon: ShieldCheck,
    title: 'Fraud & identity checks',
    text: 'PAN validation, PAN–name matching, duplicate identities, application velocity, inconsistent data and anomaly detection on every application.',
  },
  {
    icon: BarChart3,
    title: 'Clear reasons, every time',
    text: 'Every decision explains why — what counted against you, what helped, and exactly what to do to improve.',
  },
  {
    icon: Link2,
    title: 'Tamper-proof audit trail',
    text: 'Final decisions are written to the Hedera blockchain so they cannot be altered after the fact.',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const handleCta = () => {
    navigate(isAuthenticated ? '/apply' : '/signup');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
      <div className="absolute inset-0 bg-grid bg-[size:56px_56px] opacity-[0.03]" />
      <div className="absolute left-[-12rem] top-[-10rem] h-96 w-96 rounded-full bg-neon-500/8 blur-3xl" />
      <div className="absolute right-[-8rem] top-[18rem] h-72 w-72 rounded-full bg-neon-400/6 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.3em] text-neon-500">
          <ShieldCheck className="h-5 w-5" />SecureLend
        </div>
        <nav className="flex items-center gap-3 text-sm">
          {isAuthenticated ? (
            <Link className="rounded-full border border-gray-300 px-4 py-2 text-gray-700 transition hover:border-neon-500/40 hover:text-neon-500" to="/dashboard">
              Dashboard
            </Link>
          ) : (
            <Link className="rounded-full border border-gray-300 px-4 py-2 text-gray-700 transition hover:border-neon-500/40 hover:text-neon-500" to="/login">
              Login
            </Link>
          )}
          <button
            type="button"
            onClick={handleCta}
            className="rounded-full bg-neon-500 px-4 py-2 font-semibold text-white transition hover:bg-neon-400"
          >
            Apply for Loan
          </button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex rounded-full border border-neon-500/20 bg-neon-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-neon-500"
            >
              India-focused digital lending
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 max-w-3xl text-5xl font-semibold leading-tight sm:text-6xl"
            >
              Apply for personal and property loans through a trusted digital experience.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 max-w-2xl text-lg leading-8 text-gray-600"
            >
              Submit your details, track progress, and receive clear loan decisions with all values handled in INR.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex flex-wrap gap-4"
            >
              <button
                type="button"
                onClick={handleCta}
                className="inline-flex items-center gap-2 rounded-full bg-neon-500 px-6 py-3 font-semibold text-white transition hover:bg-neon-400"
              >
                Apply for Loan <ArrowRight className="h-4 w-4" />
              </button>
              {!isAuthenticated ? (
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition hover:border-neon-500/40 hover:text-neon-500"
                >
                  Create account
                </Link>
              ) : null}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-[2rem] border border-gray-200 bg-gray-50 p-6 shadow-glow backdrop-blur"
          >
            <div className="rounded-3xl border border-gray-200 bg-white p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Real workflow</p>
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-sm text-gray-600">Assessment status</p>
                <div className="mt-2 text-4xl font-semibold text-neon-500">Ready</div>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  Apply in about 3 minutes and get an instant decision — approved, sent for review, or declined — with the reasons behind it.
                </p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  ['Identity & fraud', '9 automated checks'],
                  ['Default risk', 'ML model, out-of-time AUC 0.69'],
                  ['Affordability', 'FOIR + RBI LTV rules'],
                  ['Decision', 'Instant, with reasons'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <section className="mt-20">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow"
                >
                  <div className="inline-flex rounded-2xl border border-neon-500/20 bg-neon-500/10 p-3 text-neon-500">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-600">{feature.text}</p>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
