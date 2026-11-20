import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import AppShell from '../components/AppShell';
import AssessmentView from '../components/AssessmentView';
import StatusBadge from '../components/StatusBadge';
import { formatInr } from '../utils/formatters';

const readStoredResult = () => {
  try {
    return JSON.parse(localStorage.getItem('securelend:lastResult') || 'null')?.loan || null;
  } catch {
    return null;
  }
};

/** Applications made before the new assessment engine have no detailed report. */
const LegacyResult = ({ loan }) => (
  <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow">
    <div className="flex items-center gap-3">
      <StatusBadge value={loan.status} />
      <span className="text-sm text-gray-600">Submitted with the previous application form</span>
    </div>
    <p className="mt-4 text-sm leading-6 text-gray-700">{loan.explanation || 'No detailed explanation is available for this older application.'}</p>
    <p className="mt-2 text-sm text-gray-600">
      Amount {formatInr(loan.loanAmount)} · Risk score {Math.round((loan.riskScore || 0) * 100)}% ({loan.riskCategory})
    </p>
  </div>
);

const ResultPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const [loan, setLoan] = useState(() => location.state?.loan || (id ? null : readStoredResult()));
  const [loading, setLoading] = useState(Boolean(id) && !location.state?.loan);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // Always refresh from the server so a decision made later by a loan officer is shown.
    api
      .get(`/loan/${id}`)
      .then(({ data }) => !cancelled && setLoan(data.loan))
      .catch((err) => !cancelled && setError(err.response?.data?.message || 'Unable to load this application'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <AppShell
      title="Your loan decision"
      subtitle="The decision, the reasons behind it, and what you can do next."
      actions={
        <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-neon-500/40 hover:text-neon-500">
          <ArrowLeft className="h-4 w-4" />Back to dashboard
        </Link>
      }
    >
      {loading && !loan ? (
        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 text-gray-600">Loading your decision…</div>
      ) : error && !loan ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
      ) : !loan ? (
        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 shadow-glow">
          <p className="text-gray-600">Submit a loan application to see your decision here.</p>
          <Link to="/apply" className="mt-6 inline-block rounded-full bg-neon-500 px-5 py-3 font-semibold text-white">
            Apply now
          </Link>
        </div>
      ) : loan.assessment?.headline ? (
        <AssessmentView loan={loan} />
      ) : (
        <LegacyResult loan={loan} />
      )}
    </AppShell>
  );
};

export default ResultPage;
