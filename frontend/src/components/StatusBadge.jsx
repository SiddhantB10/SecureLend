const styles = {
  pending: 'border-white/10 bg-white/5 text-white/70',
  review: 'border-neon-500/30 bg-neon-500/10 text-neon-500',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  rejected: 'border-red-500/30 bg-red-500/10 text-red-400',
};

const labels = {
  pending: 'Pending',
  review: 'Needs Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const StatusBadge = ({ value }) => (
  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${styles[value] || styles.pending}`}>
    {labels[value] || value}
  </span>
);

export default StatusBadge;
