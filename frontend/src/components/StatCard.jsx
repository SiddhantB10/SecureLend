const StatCard = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
    <p className="text-xs uppercase tracking-[0.25em] text-white/45">{label}</p>
    <div className="mt-3 text-3xl font-semibold text-neon-500">{value}</div>
    {hint ? <p className="mt-2 text-sm text-white/60">{hint}</p> : null}
  </div>
);

export default StatCard;
