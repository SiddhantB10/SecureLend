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

  const loadLoans = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/all-loans');
      setLoans(data.loans || []);
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
    const buckets = new Map();
    loans.forEach((loan) => {
      const bucket = formatIndianMonth(loan.createdAt);
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });
    return Array.from(buckets.entries()).map(([month, count]) => ({ month, count }));
  }, [loans]);

  const updateStatus = async (id, status) => {
    await api.put(`/loan/${id}/status`, { status });
    await loadLoans();
  };

  return (
    <AppShell
      title="Admin dashboard"
      subtitle="Review loan applications, complete approvals and rejections, and monitor portfolio-level trends."
      actions={
        <button type="button" onClick={loadLoans} className="rounded-full bg-neon-500 px-4 py-2 text-sm font-semibold text-black">
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
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
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

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SectionHeading eyebrow="Analytics" title="Application volume" subtitle="How many applications were captured each month." />
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip />
                <Bar dataKey="count" fill="#f8e71c" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <SectionHeading
          eyebrow="Operations"
          title="Application review queue"
          subtitle="Prioritize pending applications and complete manual decisions where required."
        />

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/55">Loading applications...</div>
          ) : loans.length ? (
            loans.map((loan) => (
              <motion.div key={loan._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/10 bg-black/35 p-5">
                <div className="grid gap-5 lg:grid-cols-[1.1fr_0.6fr_0.8fr] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">{loan.userId?.name || 'Unknown applicant'}</h3>
                      <StatusBadge value={loan.status} />
                    </div>
                    <p className="mt-2 text-sm text-white/55">
                      {loan.userId?.email || 'No email'} | Type {(loan.loanType || 'personal').toUpperCase()} | Amount {formatInr(loan.loanAmount)} | Credit score {loan.creditScore}
                    </p>
                    <p className="mt-1 text-xs text-white/45">Decision source: {loan.decisionSource === 'admin' ? 'Admin' : 'AI'}</p>
                    <p className="mt-2 text-xs text-white/40">{loan.explanation}</p>
                  </div>
                  <div className="lg:max-w-[260px]">
                    <RiskMeter score={loan.riskScore} category={loan.riskCategory} />
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {loan.status === 'review' || loan.status === 'pending' ? (
                      <>
                        <button onClick={() => updateStatus(loan._id, 'approved')} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">
                          Approve
                        </button>
                        <button onClick={() => updateStatus(loan._id, 'rejected')} className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400">
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/55">
                        No manual action required
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/55">No loan applications are available.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default AdminDashboard;
