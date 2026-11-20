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
  const [error, setError] = useState('');

  const loadLoans = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/my-loans');
      setLoans(data.loans || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load your applications');
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
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-gray-100 px-4 py-2 text-sm text-gray-700 transition hover:border-neon-500/40 hover:text-neon-500"
          >
            <RefreshCcw className="h-4 w-4" />Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate('/apply')}
            className="inline-flex items-center gap-2 rounded-full bg-neon-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neon-400"
          >
            Apply for Loan <ArrowRight className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total applications" value={totalApplications} hint="All requests submitted from your account" />
        <StatCard label="In review" value={pendingApplications} hint="Awaiting a loan officer's review" />
        <StatCard label="Approved" value={approvedApplications} hint="Auto-approved or admin-approved applications" />
      </div>

      <div className="mt-8 rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
        <SectionHeading
          eyebrow="Application history"
          title="Previous loan requests"
          subtitle="Open any application to see the decision, the reasons behind it, and what you can do next."
        />

        <div className="mt-6 space-y-4">
          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>
          ) : null}
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-100 p-6 text-gray-600">Loading your applications...</div>
          ) : loans.length ? (
            loans.map((loan) => (
              <motion.div
                key={loan._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-gray-200 bg-white p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {loan.loanType === 'property' ? 'Property loan' : 'Personal loan'} · {formatInr(loan.loanAmount)}
                      </h3>
                      <StatusBadge value={loan.status} />
                    </div>
                    <p className="mt-2 text-sm text-gray-700">
                      {loan.assessment?.headline || loan.explanation || 'Decision details unavailable.'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Applied {new Date(loan.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {loan.tenureMonths ? ` · ${loan.tenureMonths} months` : ''} · Ref {loan._id.slice(-6).toUpperCase()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-5">
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-600">Risk</p>
                      <p className="mt-1 text-lg font-semibold text-neon-500">{loan.riskBand || loan.riskCategory || '—'}</p>
                    </div>
                    <Link
                      to={`/result/${loan._id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-neon-500/40 px-4 py-2 text-sm font-semibold text-neon-500 hover:bg-neon-500/10"
                    >
                      View decision <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-100 p-6 text-gray-600">
              You have no loan applications yet. Start one now to get a risk assessment.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Link
          to="/apply"
          className="inline-flex items-center gap-2 rounded-full bg-neon-500 px-5 py-3 font-semibold text-white transition hover:bg-neon-400"
        >
          Start a new application <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AppShell>
  );
};

export default UserDashboard;
