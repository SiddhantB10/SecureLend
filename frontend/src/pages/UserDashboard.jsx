import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, RefreshCcw } from 'lucide-react';
import api from '../api/client';
import AppShell from '../components/AppShell';
import SectionHeading from '../components/SectionHeading';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { formatInr } from '../utils/formatters';

const UserDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLoans = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/my-loans');
      setLoans(data.loans || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const totalApplications = loans.length;
  const pendingApplications = loans.filter((loan) => loan.status === 'review' || loan.status === 'pending').length;
  const approvedApplications = loans.filter((loan) => loan.status === 'approved').length;

  return (
    <AppShell
      title={`Welcome back, ${user?.name || 'member'}`}
      subtitle="Track your loan applications, review status updates, and submit a new request anytime."
      actions={
        <>
          <button
            type="button"
            onClick={loadLoans}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:border-neon-500/40 hover:text-neon-500"
          >
            <RefreshCcw className="h-4 w-4" />Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate('/apply')}
            className="inline-flex items-center gap-2 rounded-full bg-neon-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-neon-400"
          >
            Apply for Loan <ArrowRight className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total applications" value={totalApplications} hint="All requests submitted from your account" />
        <StatCard label="In review" value={pendingApplications} hint="Medium-risk cases awaiting admin decision" />
        <StatCard label="Approved" value={approvedApplications} hint="Auto-approved or admin-approved applications" />
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <SectionHeading
          eyebrow="Application history"
          title="Previous loan requests"
          subtitle="Each application includes the predicted risk score, category, and review status."
        />

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/55">Loading your applications...</div>
          ) : loans.length ? (
            loans.map((loan) => (
              <motion.div
                key={loan._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/10 bg-black/40 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">Loan {loan._id.slice(-6).toUpperCase()}</h3>
                      <StatusBadge value={loan.status} />
                    </div>
                    <p className="mt-2 text-sm text-white/55">
                      Type {(loan.loanType || 'personal').toUpperCase()} | Loan amount {formatInr(loan.loanAmount)} | Credit score {loan.creditScore}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      Blockchain tx id: <span className="text-white/65">{loan.blockchainTxHash || 'Not recorded yet'}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/45">Risk score</p>
                    <p className="mt-2 text-2xl font-semibold text-neon-500">{Math.round(loan.riskScore * 100)}%</p>
                    <p className="text-sm text-white/55">{loan.riskCategory} risk</p>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/55">
              You have no loan applications yet. Start one now to get a risk assessment.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Link
          to="/apply"
          className="inline-flex items-center gap-2 rounded-full bg-neon-500 px-5 py-3 font-semibold text-black transition hover:bg-neon-400"
        >
          Start a new application <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AppShell>
  );
};

export default UserDashboard;
