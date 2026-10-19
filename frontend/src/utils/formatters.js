const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const formatInr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return inrFormatter.format(0);
  }
  return inrFormatter.format(amount);
};

export const formatIndianMonth = (value) => new Date(value).toLocaleString('en-IN', { month: 'short' });
