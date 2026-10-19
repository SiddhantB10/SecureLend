import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const isLocalhost =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const fallbackApiUrl = isLocalhost ? 'http://127.0.0.1:5000' : 'https://securelend-1.onrender.com';
const baseURL = isLocalhost && configuredApiUrl?.includes('onrender.com')
  ? 'http://127.0.0.1:5000'
  : configuredApiUrl || fallbackApiUrl;

const api = axios.create({
  baseURL,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('securelend:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
