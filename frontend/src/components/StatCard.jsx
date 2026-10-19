const StatCard = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-glow">
    <p className="text-xs uppercase tracking-[0.25em] text-gray-600">{label}</p>
    <div className="mt-3 text-3xl font-semibold text-neon-500">{value}</div>
    {hint ? <p className="mt-2 text-sm text-gray-600">{hint}</p> : null}
  </div>
);

export default StatCard;
