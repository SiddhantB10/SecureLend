import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Info,
  Lightbulb,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { formatInr } from '../utils/formatters';
import { EMPLOYMENT_TYPES, PURPOSES, RESIDENCE_TYPES, formatPct, labelFor } from '../utils/lending';

const STATUS_STYLE = {
  approved: { icon: CheckCircle2, label: 'Approved', box: 'border-emerald-300 bg-emerald-50', text: 'text-emerald-700' },
  review: { icon: Clock3, label: 'Under review', box: 'border-amber-300 bg-amber-50', text: 'text-amber-700' },
  rejected: { icon: XCircle, label: 'Declined', box: 'border-red-300 bg-red-50', text: 'text-red-700' },
  pending: { icon: Clock3, label: 'Pending', box: 'border-gray-300 bg-gray-50', text: 'text-gray-700' },
};

const BAND_STYLE = {
  'Very low': 'bg-emerald-600',
  Low: 'bg-emerald-500',
  Medium: 'bg-amber-500',
  High: 'bg-orange-600',
  'Very high': 'bg-red-600',
  'Not scored': 'bg-gray-400',
};

const CHECK_ICON = {
  pass: { icon: CheckCircle2, className: 'text-emerald-600' },
  warn: { icon: AlertTriangle, className: 'text-amber-600' },
  fail: { icon: XCircle, className: 'text-red-600' },
  info: { icon: Info, className: 'text-gray-500' },
};

const Card = ({ title, icon: Icon, children, className = '' }) => (
  <section className={`rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-glow ${className}`}>
    <div className="flex items-center gap-2 text-neon-500">
      {Icon ? <Icon className="h-5 w-5" /> : null}
      <h3 className="text-xs font-semibold uppercase tracking-[0.3em]">{title}</h3>
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const Stat = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4">
    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</p>
    <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
  </div>
);

const FactorBar = ({ item, max }) => {
  const width = Math.max(6, Math.round((Math.abs(item.impact) / max) * 100));
  const up = item.impact > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-gray-800">
          {item.label}: <span className="font-semibold">{item.value}</span>
        </span>
        <span className={`shrink-0 text-xs font-semibold ${up ? 'text-red-600' : 'text-emerald-600'}`}>
          {up ? '+' : '−'}
          {(Math.abs(item.impact) * 100).toFixed(1)} pts
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${up ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${width}%` }} />
      </div>
      {item.typicalValue ? <p className="mt-0.5 text-xs text-gray-500">Typical repaid borrower: {item.typicalValue}</p> : null}
    </div>
  );
};

/** Full, human-readable decision report for a loan application. */
const AssessmentView = ({ loan, adminView = false }) => {
  const a = loan.assessment || {};
  const m = a.metrics || {};
  const status = loan.status || a.status;
  const style = STATUS_STYLE[status] || STATUS_STYLE.pending;
  const StatusIcon = style.icon;
  const negatives = (a.reasons || []).filter((r) => r.severity === 'decline' || r.severity === 'review');
  const factors = [...(a.riskDrivers || []), ...(a.riskReducers || [])];
  const maxImpact = Math.max(0.01, ...factors.map((f) => Math.abs(f.impact)));
  const isProperty = loan.loanType === 'property';

  return (
    <div className="space-y-6">
      {/* Decision banner */}
      <section className={`rounded-3xl border p-6 ${style.box}`}>
        <div className="flex flex-wrap items-start gap-4">
          <StatusIcon className={`h-10 w-10 shrink-0 ${style.text}`} />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${style.text}`}>
              {style.label}
              {loan.decisionSource === 'admin' ? ' · by loan officer' : ' · automated decision'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">{a.headline}</h2>
            <p className="mt-3 text-sm leading-6 text-gray-700">{a.summary}</p>
            {loan.adminNotes && loan.decisionSource === 'admin' ? (
              <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm text-gray-700">
                <span className="font-semibold">Officer's note:</span> {loan.adminNotes}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Offer */}
        {a.offer && status !== 'rejected' ? (
          <Card title={status === 'approved' ? 'Your offer' : 'Offer if approved'} icon={BadgeCheck}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Loan amount" value={formatInr(a.offer.amount)} />
              <Stat label="Interest rate" value={`${a.offer.interestRate}% p.a.`} hint={`Risk band: ${m.riskBand}`} />
              <Stat label="Monthly EMI" value={formatInr(a.offer.emi)} hint={`for ${a.offer.tenureMonths} months`} />
              <Stat label="Total interest" value={formatInr(a.offer.totalInterest)} hint={`Total payable ${formatInr(a.offer.totalPayable)}`} />
            </div>
            <p className="mt-3 text-xs text-gray-500">Indicative. Final sanction is subject to KYC and income-document verification.</p>
          </Card>
        ) : (
          <Card title="What you can borrow" icon={BadgeCheck}>
            {a.counterOffer ? (
              <p className="text-sm leading-6 text-gray-700">
                Based on your income and existing EMIs, you may qualify for up to{' '}
                <span className="text-lg font-semibold text-gray-900">{formatInr(a.counterOffer)}</span> over {loan.tenureMonths} months. You can reapply for this
                amount once the reasons below are addressed.
              </p>
            ) : (
              <p className="text-sm leading-6 text-gray-700">
                {m.eligibleAmount > 0
                  ? `Your income supports a loan of about ${formatInr(m.eligibleAmount)}, but the issues below must be resolved first.`
                  : 'We could not make an offer based on the details provided.'}
              </p>
            )}
          </Card>
        )}

        {/* Key numbers */}
        <Card title="Key numbers" icon={FileText}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Risk of default</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-900">{m.scored === false ? 'Not scored' : formatPct(m.probabilityOfDefault, 1)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${BAND_STYLE[m.riskBand] || 'bg-gray-400'}`}>{m.riskBand}</span>
              </div>
              <p className="text-xs text-gray-500">{m.scored === false ? 'No credit history to score' : `Auto-approve below ${formatPct(m.approvePd)}`}</p>
            </div>
            <Stat label="EMIs vs income (FOIR)" value={m.foir === null || m.foir === undefined ? '—' : formatPct(m.foir)} hint={`Comfortable ≤ ${formatPct(m.foirLimit ?? 0.5)}, max 60%`} />
            {isProperty ? <Stat label="Loan-to-value" value={formatPct(m.ltv)} hint={`RBI limit ${formatPct(m.ltvCap)}`} /> : null}
            <Stat label="Max affordable loan" value={formatInr(m.eligibleAmount)} hint="At ≤50% FOIR for this tenure" />
            {m.ageAtMaturity ? <Stat label="Age at end of loan" value={Math.round(m.ageAtMaturity)} /> : null}
          </div>
        </Card>
      </div>

      {/* Reasons */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={status === 'approved' ? 'Why you were approved' : 'Why this decision'} icon={Info}>
          {negatives.length ? (
            <ul className="space-y-3">
              {negatives.map((r) => (
                <li key={r.code} className="flex gap-3">
                  {r.severity === 'decline' ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {r.title}{' '}
                      <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${r.severity === 'decline' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.severity === 'decline' ? 'reason for decline' : 'needs review'}
                      </span>
                    </p>
                    <p className="text-sm leading-6 text-gray-600">{r.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {a.strengths?.length ? (
            <div className={negatives.length ? 'mt-5 border-t border-gray-200 pt-4' : ''}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">In your favour</p>
              <ul className="space-y-2">
                {a.strengths.map((s) => (
                  <li key={s} className="flex gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card title="Risk model factors" icon={TrendingUp}>
          {m.scored === false ? (
            <p className="text-sm text-gray-600">Not scored: the credit-risk model needs a credit history.</p>
          ) : factors.length ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                How much each detail moved your default risk compared with a typical borrower who repaid in full (percentage points).
              </p>
              {factors.map((f) => (
                <FactorBar key={f.label} item={f} max={maxImpact} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Your profile is close to a typical repaid borrower on every factor.</p>
          )}
          {a.model ? (
            <p className="mt-4 flex items-center gap-1 text-xs text-gray-500">
              <TrendingDown className="h-3 w-3" />
              Model: {a.model.name?.replace(/_/g, ' ')}
              {a.model.rocAuc ? ` · out-of-time ROC-AUC ${a.model.rocAuc}` : ''} · trained on {a.model.trainedOn}
              {a.scoringSource === 'scorecard-fallback' ? ' · backup scorecard used' : ''}
            </p>
          ) : null}
        </Card>
      </div>

      {a.improvements?.length && status !== 'approved' ? (
        <Card title="What you can do" icon={Lightbulb}>
          <ul className="space-y-2">
            {a.improvements.map((tip) => (
              <li key={tip} className="flex gap-2 text-sm text-gray-700">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-neon-500" />
                {tip}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Identity & fraud checks" icon={ShieldCheck}>
          <ul className="space-y-2">
            {(a.checks || []).map((c) => {
              const { icon: Icon, className } = CHECK_ICON[c.status] || CHECK_ICON.info;
              return (
                <li key={c.code} className="flex gap-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-600">{c.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Application details" icon={FileText}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              ['Applicant', loan.applicant?.fullName],
              ['PAN', loan.applicant?.panMasked],
              ['Loan type', isProperty ? 'Property loan' : 'Personal loan'],
              ['Amount', formatInr(loan.loanAmount)],
              ['Tenure', `${loan.tenureMonths} months`],
              isProperty ? ['Property value', formatInr(loan.propertyValue)] : ['Purpose', labelFor(PURPOSES, loan.purpose)],
              ['Employment', labelFor(EMPLOYMENT_TYPES, loan.employmentType)],
              ['Net monthly income', formatInr(loan.monthlyIncome)],
              ['Existing EMIs', formatInr(loan.existingEmi)],
              ['Residence', labelFor(RESIDENCE_TYPES, loan.residenceType)],
              ['Credit score', loan.noCreditHistory ? 'No credit history' : loan.creditScore],
              ...(adminView && loan.userId?.email ? [['Account', loan.userId.email]] : []),
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-[0.15em] text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 border-t border-gray-200 pt-3 text-xs text-gray-500">
            Blockchain audit record:{' '}
            {loan.blockchainTxHash ? (
              <a
                href={`https://hashscan.io/testnet/transaction/${loan.blockchainTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-mono text-neon-500 underline"
              >
                {loan.blockchainTxHash}
              </a>
            ) : (
              <span>{status === 'review' ? 'recorded once the review is complete' : 'not recorded'}</span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AssessmentView;
