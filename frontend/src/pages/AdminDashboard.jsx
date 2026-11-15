import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import api from '../api/client';
import AppShell from '../components/AppShell';
import RiskMeter from '../components/RiskMeter';
import SectionHeading from '../components/SectionHeading';
import StatusBadge from '../components/StatusBadge';
import StatCard from '../components/StatCard';
import { formatIndianMonth, formatInr } from '../utils/formatters';

const STATUS_COLORS = {
  low: '#10b981',
  medium: '#f8e71c',
  high: '#ef4444',
};

const AdminDashboard = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const loadLoans = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/all-loans');
      setLoans(data.loans || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const summary = useMemo(() => {
    const total = loans.length;
    const pending = loans.filter((loan) => loan.status === 'review' || loan.status === 'pending').length;
    const approved = loans.filter((loan) => loan.status === 'approved').length;
    const rejected = loans.filter((loan) => loan.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [loans]);

  const riskDistribution = useMemo(() => {
    const low = loans.filter((loan) => loan.riskCategory === 'Low').length;
    const medium = loans.filter((loan) => loan.riskCategory === 'Medium').length;
    const high = loans.filter((loan) => loan.riskCategory === 'High').length;
    return [
      { name: 'Low', value: low, fill: STATUS_COLORS.low },
      { name: 'Medium', value: medium, fill: STATUS_COLORS.medium },
      { name: 'High', value: high, fill: STATUS_COLORS.high },
    ];
  }, [loans]);

  const monthlyStats = useMemo(() => {
    // Bucket by year+month so e.g. Nov 2025 and Nov 2026 are not merged, and keep chronological order.
    const buckets = new Map();
    loans.forEach((loan) => {
      const date = new Date(loan.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const key = date.getFullYear() * 12 + date.getMonth();
      const current = buckets.get(key) || { month: formatIndianMonth(date), count: 0 };
      current.count += 1;
      buckets.set(key, current);
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([, value]) => value);
  }, [loans]);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.put(`/loan/${id}/status`, { status });
      if (data.blockchainWarning) setNotice(data.message);
      await loadLoans();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update loan status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AppShell
      title="Admin dashboard"
      subtitle="Review loan applications, complete approvals and rejections, and monitor portfolio-level trends."
      actions={
        <button type="button" onClick={loadLoans} className="rounded-full bg-neon-500 px-4 py-2 text-sm font-semibold text-white">
          Refresh data
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total applications" value={summary.total} hint="All loan applications in the system" />
        <StatCard label="In review" value={summary.pending} hint="Requires manual admin action" />
        <StatCard label="Approved" value={summary.approved} hint="Accepted applications" />
        <StatCard label="Rejected" value={summary.rejected} hint="Declined applications" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
          <SectionHeading eyebrow="Analytics" title="Risk distribution" subtitle="Pie chart of predicted risk categories across all applications." />
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name" outerRadius={110} innerRadius={70} paddingAngle={3}>
                  {riskDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
          <SectionHeading eyebrow="Analytics" title="Application volume" subtitle="How many applications were captured each month." />
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="month" stroke="rgba(0,0,0,0.6)" />
                <YAxis stroke="rgba(0,0,0,0.6)" />
                <Tooltip />
                <Bar dataKey="count" fill="#0066cc" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
        <SectionHeading
          eyebrow="Operations"
          title="Application review queue"
          subtitle="Prioritize pending applications and complete manual decisions where required."
        />

        <div className="mt-6 space-y-4">
          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>
          ) : null}
          {notice ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">{notice}</div>
          ) : null}
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-100 p-6 text-gray-600">Loading applications...</div>
          ) : loans.length ? (
            loans.map((loan) => (
              <motion.div key={loan._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="grid gap-5 lg:grid-cols-[1.1fr_0.6fr_0.8fr] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{loan.userId?.name || 'Unknown applicant'}</h3>
                      <StatusBadge value={loan.status} />
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      {loan.userId?.email || 'No email'} | Type {(loan.loanType || 'personal').toUpperCase()} | Amount {formatInr(loan.loanAmount)} | Credit score {loan.creditScore}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Decision source: {loan.decisionSource === 'admin' ? 'Admin' : 'AI'}</p>
                    <p className="mt-2 text-xs text-gray-600">{loan.explanation}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Blockchain tx id:{' '}
                      {loan.blockchainTxHash ? (
                        <a
                          href={`https://hashscan.io/testnet/transaction/${loan.blockchainTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-neon-500 underline hover:text-neon-400 break-all"
                        >
                          {loan.blockchainTxHash}
                        </a>
                      ) : (
                        <span className="text-gray-700">Not recorded yet</span>
                      )}
                    </p>
                  </div>
                  <div className="lg:max-w-[260px]">
                    <RiskMeter score={loan.riskScore} category={loan.riskCategory} />
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {loan.status === 'review' || loan.status === 'pending' ? (
                      <>
                        <button disabled={updatingId === loan._id} onClick={() => updateStatus(loan._id, 'approved')} className="rounded-full disabled:opacity-50 border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-600">
                          Approve
                        </button>
                        <button disabled={updatingId === loan._id} onClick={() => updateStatus(loan._id, 'rejected')} className="rounded-full disabled:opacity-50 border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600">
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full border border-gray-300 bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-500">
                        No manual action required
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-100 p-6 text-gray-600">No loan applications are available.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default AdminDashboard;
