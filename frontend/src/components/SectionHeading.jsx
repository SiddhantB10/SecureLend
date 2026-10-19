const SectionHeading = ({ eyebrow, title, subtitle }) => (
  <div className="max-w-3xl">
    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-neon-500/75">{eyebrow}</p>
    <h2 className="mt-3 text-2xl font-semibold text-gray-900 sm:text-3xl">{title}</h2>
    {subtitle ? <p className="mt-3 text-sm leading-6 text-gray-600">{subtitle}</p> : null}
  </div>
);

export default SectionHeading;
