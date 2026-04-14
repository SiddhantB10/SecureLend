const axios = require('axios');

const predictLoanRisk = async (payload) => {
  const baseUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
  const response = await axios.post(`${baseUrl}/predict`, payload, {
    timeout: 20000,
  });

  return response.data;
};

module.exports = {
  predictLoanRisk,
};
