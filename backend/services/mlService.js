const axios = require('axios');

// The ML service in this workspace runs on port 8001 by default (uvicorn start).
const LOCAL_ML_URL = 'http://127.0.0.1:8001';

const getCandidateBaseUrls = () => {
  const configured = String(process.env.ML_SERVICE_URL || '').trim();

  if (!configured) {
    return [LOCAL_ML_URL];
  }

  // In local development, try the local ML service first, then the configured URL as fallback.
  if (configured !== LOCAL_ML_URL && process.env.NODE_ENV !== 'production') {
    return [LOCAL_ML_URL, configured];
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
