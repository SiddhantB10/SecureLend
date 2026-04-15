import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, BrainCircuit, Link2, BarChart3, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: BrainCircuit,
    title: 'Smart eligibility checks',
    text: 'Each application is assessed consistently using verified financial and profile inputs.',
  },
  {
    icon: Link2,
    title: 'Secure decision records',
    text: 'Application outcomes are stored with traceable records for transparency and accountability.',
  },
  {
    icon: BarChart3,
    title: 'Application insights',
    text: 'Track approvals, pending cases, and overall lending activity in one view.',
  },
  {
    icon: Sparkles,
    title: 'Designed for customers',
    text: 'A fast, responsive dark interface with subtle motion and premium data cards.',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const handleCta = () => {
    navigate(isAuthenticated ? '/apply' : '/signup');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-secure-950 text-white">
      <div className="absolute inset-0 bg-grid bg-[size:56px_56px] opacity-[0.06]" />
      <div className="absolute left-[-12rem] top-[-10rem] h-96 w-96 rounded-full bg-neon-500/12 blur-3xl" />
      <div className="absolute right-[-8rem] top-[18rem] h-72 w-72 rounded-full bg-neon-400/10 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.3em] text-neon-500">
          <ShieldCheck className="h-5 w-5" />SecureLend
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link className="rounded-full border border-white/10 px-4 py-2 text-white/75 transition hover:border-neon-500/40 hover:text-neon-500" to="/login">
            Login
          </Link>
          <button
            type="button"
            onClick={handleCta}
            className="rounded-full bg-neon-500 px-4 py-2 font-semibold text-black transition hover:bg-neon-400"
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
              className="mt-6 max-w-2xl text-lg leading-8 text-white/68"
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
                className="inline-flex items-center gap-2 rounded-full bg-neon-500 px-6 py-3 font-semibold text-black transition hover:bg-neon-400"
              >
                Apply for Loan <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to={isAuthenticated ? '/dashboard' : '/signup'}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-6 py-3 font-semibold text-white/80 transition hover:border-neon-500/40 hover:text-neon-500"
              >
                {isAuthenticated ? `Continue as ${user?.name || 'user'}` : 'Create account'}
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur"
          >
            <div className="rounded-3xl border border-white/10 bg-black/50 p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-white/45">Live signal</p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-white/55">Application score</p>
                  <div className="mt-2 text-5xl font-semibold text-neon-500">0.23</div>
                </div>
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">
                  Low risk
                </div>
              </div>
              <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[23%] rounded-full bg-neon-500" />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  ['Processing time', 'Fast turnaround'],
                  ['Data security', 'Protected records'],
                  ['Decision clarity', 'Clear status updates'],
                  ['Access', 'Secure sign-in'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/40">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-white">{value}</p>
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
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow"
                >
                  <div className="inline-flex rounded-2xl border border-neon-500/20 bg-neon-500/10 p-3 text-neon-500">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/62">{feature.text}</p>
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
