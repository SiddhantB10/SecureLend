import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import AppShell from '../components/AppShell';
import RiskMeter from '../components/RiskMeter';
import SectionHeading from '../components/SectionHeading';

const ResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state || JSON.parse(localStorage.getItem('securelend:lastResult') || 'null');

  const loan = result?.loan;
  const prediction = result?.prediction;

  const featureImportance = useMemo(() => prediction?.featureImportance || [], [prediction]);

  if (!loan || !prediction) {
    return (
      <AppShell title="Analysis result" subtitle="No loan result was found in the current session.">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow">
          <p className="text-white/60">Submit a loan application to see the AI-generated risk analysis here.</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/apply')}
              className="rounded-full bg-neon-500 px-5 py-3 font-semibold text-black"
            >
              Back to application
            </button>
            <Link to="/dashboard" className="rounded-full border border-white/10 px-5 py-3 font-semibold text-white/75">
              Dashboard
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Risk analysis result"
      subtitle="The model output below combines Random Forest probability, feature importance, and a textual explanation for the decision."
      actions={
        <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 hover:border-neon-500/40 hover:text-neon-500">
          <ArrowLeft className="h-4 w-4" />Back to dashboard
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <RiskMeter score={prediction.riskScore} category={prediction.category} />

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SectionHeading eyebrow="Explainable AI" title="Why the model made this call" subtitle="The text below summarizes the risk drivers surfaced by the ML service." />
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5 text-sm leading-7 text-white/70">
            {prediction.explanation}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {featureImportance.slice(0, 4).map((item) => (
              <div key={item.feature} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-white/45">{item.feature}</p>
                <p className="mt-2 text-lg font-semibold text-neon-500">{item.importance}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <div className="flex items-center gap-2 text-neon-500">
          <FileText className="h-5 w-5" />
          <p className="text-xs uppercase tracking-[0.35em]">Stored application</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Applicant', loan.personalInfo?.name || 'N/A'],
            ['Income', `$${Number(loan.income).toLocaleString()}`],
            ['Credit score', loan.creditScore],
            ['Loan amount', `$${Number(loan.loanAmount).toLocaleString()}`],
            ['Decision', `${loan.status?.toUpperCase()} (${loan.decisionSource === 'admin' ? 'Admin' : 'AI'})`],
            ['AI model', loan.aiModel || 'random_forest'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-white/40">{label}</p>
              <p className="mt-2 text-base font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default ResultPage;
