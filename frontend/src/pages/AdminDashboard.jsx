import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronUp, Cpu, History } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import api from '../api/client';
import AppShell from '../components/AppShell';
import AssessmentView from '../components/AssessmentView';
import SectionHeading from '../components/SectionHeading';
import StatusBadge from '../components/StatusBadge';
import StatCard from '../components/StatCard';
import { formatIndianMonth, formatInr } from '../utils/formatters';

const RISK_COLORS = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };
const FILTERS = [
  { key: 'review', label: 'Review queue' },
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Declined' },
];

const ACTION_LABELS = {
  LOAN_APPROVED: 'Approved application',
  LOAN_REJECTED: 'Declined application',
  ADMIN_LOGIN: 'Signed in',
};

const AuditLogPanel = ({ logs }) => (
  <div className="overflow-x-auto">
    {logs.length ? (
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.15em] text-gray-500">
          <tr>
            <th className="py-2">When</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Application</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody className="text-gray-800">
          {logs.map((log) => (
            <tr key={log._id} className="border-t border-gray-200 align-top">
              <td className="whitespace-nowrap py-2 pr-4">
                {new Date(log.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="pr-4">{log.adminUserId?.name || log.adminUserId?.email || 'Admin'}</td>
              <td className="pr-4">{ACTION_LABELS[log.action] || log.action}</td>
              <td className="pr-4 font-mono text-xs">{log.entityType === 'loan' ? log.entityId.slice(-6).toUpperCase() : '—'}</td>
              <td className="text-gray-600">{log.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <p className="text-sm text-gray-600">No admin actions recorded yet.</p>
    )}
  </div>
);

const flagCount = (loan) => (loan.assessment?.checks || []).filter((c) => c.status === 'warn' || c.status === 'fail').length;

const ModelPanel = ({ info }) => {
  if (!info) {
    return <p className="text-sm text-gray-600">Model information is loading or the ML service is waking up…</p>;
  }
  const personal = info.personal?.test;
  const property = info.property?.test;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Personal ROC-AUC', personal?.rocAuc],
          ['Property ROC-AUC', property?.rocAuc],
          ['KS (personal)', personal?.ks],
          ['Brier score', personal?.brierScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{value ?? '—'}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-600">
        Trained on {info.dataset?.loans?.toLocaleString('en-IN')} real loans ({info.dataset?.name}, default rate {(info.dataset?.defaultRate * 100).toFixed(1)}%).
        Tested out-of-time on the {info.personal?.testLoans?.toLocaleString('en-IN')} newest loans. Version {info.modelVersion}.
      </p>
      {personal?.riskBands ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.15em] text-gray-500">
              <tr>
                <th className="py-2">Risk band</th>
                <th>Predicted default</th>
                <th>Share of test loans</th>
                <th>Actual default rate</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {personal.riskBands.map((b) => (
                <tr key={b.band} className="border-t border-gray-200">
                  <td className="py-2 font-medium">{b.band}</td>
                  <td>
                    {Math.round(b.pdRange[0] * 100)}–{Math.round(Math.min(b.pdRange[1], 1) * 100)}%
                  </td>
                  <td>{(b.shareOfApplicants * 100).toFixed(1)}%</td>
                  <td>{b.observedDefaultRate === null ? '—' : `${(b.observedDefaultRate * 100).toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

const AdminDashboard = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('review');
  const [expanded, setExpanded] = useState(null);
  const [notes, setNotes] = useState({});
  const [updatingId, setUpdatingId] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  const loadAuditLogs = () =>
    api
      .get('/admin/audit-logs')
      .then(({ data }) => setAuditLogs(data.logs || []))
      .catch(() => {});

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
    loadAuditLogs();
    api.get('/model-info').then(({ data }) => setModelInfo(data)).catch(() => {});
  }, []);

  const summary = useMemo(
    () => ({
      total: loans.length,
      review: loans.filter((l) => l.status === 'review' || l.status === 'pending').length,
      approved: loans.filter((l) => l.status === 'approved').length,
      rejected: loans.filter((l) => l.status === 'rejected').length,
      flagged: loans.filter((l) => flagCount(l) > 0).length,
    }),
    [loans]
  );

  const riskDistribution = useMemo(
    () =>
      ['Low', 'Medium', 'High'].map((name) => ({
        name,
        value: loans.filter((l) => l.riskCategory === name).length,
        fill: RISK_COLORS[name],
      })),
    [loans]
  );

  const monthlyStats = useMemo(() => {
    const buckets = new Map();
    loans.forEach((loan) => {
      const date = new Date(loan.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const key = date.getFullYear() * 12 + date.getMonth();
      const current = buckets.get(key) || { month: formatIndianMonth(date), approved: 0, review: 0, rejected: 0 };
      const bucket = loan.status === 'approved' ? 'approved' : loan.status === 'rejected' ? 'rejected' : 'review';
      current[bucket] += 1;
      buckets.set(key, current);
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([, value]) => value);
  }, [loans]);

  const visible = useMemo(() => {
    if (filter === 'all') return loans;
    if (filter === 'review') return loans.filter((l) => l.status === 'review' || l.status === 'pending');
    return loans.filter((l) => l.status === filter);
  }, [loans, filter]);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.put(`/loan/${id}/status`, { status, adminNotes: notes[id] || '' });
      setNotice(data.blockchainWarning ? data.message : `Application ${status === 'approved' ? 'approved' : 'declined'}.`);
      await Promise.all([loadLoans(), loadAuditLogs()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update loan status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AppShell
      title="Admin dashboard"
      subtitle="Work the manual-review queue, inspect every automated decision, and monitor model performance."
      actions={
        <button type="button" onClick={loadLoans} className="rounded-full bg-neon-500 px-4 py-2 text-sm font-semibold text-white">
          Refresh data
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Applications" value={summary.total} hint="All time" />
        <StatCard label="Needs review" value={summary.review} hint="Waiting for an officer" />
        <StatCard label="Approved" value={summary.approved} hint="Auto + officer approved" />
        <StatCard label="Declined" value={summary.rejected} hint="Auto + officer declined" />
        <StatCard label="Fraud flags" value={summary.flagged} hint="Failed or warned identity checks" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
          <SectionHeading eyebrow="Analytics" title="Risk mix" subtitle="Applications by model risk category." />
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
          <SectionHeading eyebrow="Analytics" title="Decisions per month" subtitle="Approved, in review and declined applications." />
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="month" stroke="rgba(0,0,0,0.6)" />
                <YAxis allowDecimals={false} stroke="rgba(0,0,0,0.6)" />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" stackId="a" fill="#10b981" name="Approved" />
                <Bar dataKey="review" stackId="a" fill="#f59e0b" name="Review" />
                <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Declined" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
        <div className="flex items-center gap-2 text-neon-500">
          <Cpu className="h-5 w-5" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em]">Credit-risk model performance</p>
        </div>
        <div className="mt-4">
          <ModelPanel info={modelInfo} />
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
        <SectionHeading eyebrow="Operations" title="Applications" subtitle="Open an application to see the full decision report, fraud checks and model factors." />

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === f.key ? 'bg-neon-500 text-white' : 'border border-gray-300 bg-white text-gray-700'}`}
            >
              {f.label}
              {f.key === 'review' && summary.review ? ` (${summary.review})` : ''}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div> : null}
          {notice ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-100 p-6 text-gray-600">Loading applications…</div>
          ) : visible.length ? (
            visible.map((loan) => {
              const flags = flagCount(loan);
              const isOpen = expanded === loan._id;
              const canDecide = loan.status === 'review' || loan.status === 'pending';
              return (
                <motion.div key={loan._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{loan.applicant?.fullName || loan.userId?.name || 'Unknown applicant'}</h3>
                        <StatusBadge value={loan.status} />
                        {flags ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            <AlertTriangle className="h-3 w-3" /> {flags} fraud flag{flags > 1 ? 's' : ''}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {loan.loanType === 'property' ? 'Property' : 'Personal'} · {formatInr(loan.loanAmount)}
                        {loan.tenureMonths ? ` · ${loan.tenureMonths} mo` : ''} · {loan.userId?.email || 'no email'} · Risk {loan.riskBand || loan.riskCategory}
                        {typeof loan.riskScore === 'number' ? ` (${(loan.riskScore * 100).toFixed(1)}%)` : ''}
                      </p>
                      <p className="mt-1 text-sm text-gray-800">{loan.assessment?.headline || loan.explanation}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : loan._id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-neon-500/40"
                    >
                      {isOpen ? 'Hide report' : 'Open report'} {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {canDecide ? (
                    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-end">
                      <label className="flex-1 text-sm text-gray-800">
                        <span className="mb-1 block font-medium">Officer's note (shown to the applicant)</span>
                        <textarea
                          rows={2}
                          value={notes[loan._id] || ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [loan._id]: e.target.value }))}
                          className="secure-textarea w-full"
                          placeholder="e.g. Verified salary slips and CIBIL report"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={updatingId === loan._id}
                          onClick={() => updateStatus(loan._id, 'approved')}
                          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === loan._id}
                          onClick={() => updateStatus(loan._id, 'rejected')}
                          className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isOpen ? (
                    <div className="mt-5 border-t border-gray-200 pt-5">
                      {loan.assessment?.headline ? (
                        <AssessmentView loan={loan} adminView />
                      ) : (
                        <p className="text-sm text-gray-600">Legacy application (submitted before the new assessment engine): {loan.explanation}</p>
                      )}
                    </div>
                  ) : null}
                </motion.div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-100 p-6 text-gray-600">No applications in this view.</div>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
        <div className="flex items-center gap-2 text-neon-500">
          <History className="h-5 w-5" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em]">Admin audit log</p>
        </div>
        <p className="mt-2 text-sm text-gray-600">Every sign-in and manual decision, newest first. Final decisions are also written to the blockchain.</p>
        <div className="mt-4">
          <AuditLogPanel logs={auditLogs} />
        </div>
      </div>
    </AppShell>
  );
};

export default AdminDashboard;
