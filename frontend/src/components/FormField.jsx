const FormField = ({ label, error, children, hint }) => (
  <label className="block space-y-2 text-sm text-white/80">
    <span className="block font-medium">{label}</span>
    {children}
    {hint ? <span className="block text-xs text-white/45">{hint}</span> : null}
    {error ? <span className="block text-xs text-red-400">{error}</span> : null}
  </label>
);

export default FormField;
