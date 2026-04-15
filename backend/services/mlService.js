const axios = require('axios');

const predictLoanRisk = async (payload) => {
  const baseUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
  const timeoutMs = Number(process.env.ML_SERVICE_TIMEOUT_MS || 3500);
  const response = await axios.post(`${baseUrl}/predict`, payload, {
    timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3500,
  });

  return response.data;
};

module.exports = {
  predictLoanRisk,
};
