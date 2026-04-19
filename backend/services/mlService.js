const axios = require('axios');

const LOCAL_ML_URL = 'http://127.0.0.1:8000';

const getCandidateBaseUrls = () => {
  const configured = String(process.env.ML_SERVICE_URL || '').trim();

  if (!configured) {
    return [LOCAL_ML_URL];
  }

  // In local development, try configured URL first, then local ML service as fallback.
  if (configured !== LOCAL_ML_URL && process.env.NODE_ENV !== 'production') {
    return [configured, LOCAL_ML_URL];
  }

  return [configured];
};

const predictLoanRisk = async (payload) => {
  const timeoutMs = Number(process.env.ML_SERVICE_TIMEOUT_MS || 3500);
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3500;
  const errors = [];

  for (const baseUrl of getCandidateBaseUrls()) {
    try {
      const response = await axios.post(`${baseUrl}/predict`, payload, { timeout });
      return response.data;
    } catch (error) {
      errors.push(`${baseUrl}: ${error.message}`);
    }
  }

  throw new Error(`ML prediction failed (${errors.join(' | ')})`);
};

module.exports = {
  predictLoanRisk,
};
