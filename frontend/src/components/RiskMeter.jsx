const RiskMeter = ({ score, category }) => {
  const percent = Math.max(0, Math.min(100, Math.round((score || 0) * 100)));
  const tone =
    category === 'Low' ? 'bg-emerald-500' : category === 'High' ? 'bg-red-500' : 'bg-neon-500';

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/45">Risk score</p>
          <div className="mt-2 text-4xl font-semibold text-white">{percent}%</div>
        </div>
        <div className={`rounded-full px-4 py-2 text-sm font-semibold text-black ${tone}`}>{category}</div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export default RiskMeter;
