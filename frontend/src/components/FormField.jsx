const FormField = ({ label, error, children, hint }) => (
  <label className="block space-y-2 text-sm text-gray-900">
    <span className="block font-medium">{label}</span>
    {children}
    {hint ? <span className="block text-xs text-gray-500">{hint}</span> : null}
    {error ? <span className="block text-xs text-red-600">{error}</span> : null}
  </label>
);

export default FormField;
