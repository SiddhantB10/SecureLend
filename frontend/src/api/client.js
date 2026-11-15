import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
const isLocalhost =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const fallbackApiUrl = isLocalhost ? 'http://127.0.0.1:5000' : 'https://securelend-1.onrender.com';
export const API_BASE_URL = isLocalhost && configuredApiUrl?.includes('onrender.com')
  ? 'http://127.0.0.1:5000'
  : configuredApiUrl || fallbackApiUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  // Free-tier hosts (Render) can take ~50s to wake up, so allow a generous timeout.
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('securelend:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// When a stored session token is expired/invalid, clear it and send the user to login
// instead of leaving them on a dashboard that silently fails to load.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthCall = ['/login', '/signup', '/auth/'].some((path) => url.startsWith(path));
    if (status === 401 && !isAuthCall && localStorage.getItem('securelend:token')) {
      localStorage.removeItem('securelend:token');
      localStorage.removeItem('securelend:user');
      localStorage.removeItem('securelend:lastResult');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    if (error.code === 'ECONNABORTED' && !error.response) {
      error.response = { data: { message: 'The server took too long to respond. Please try again.' } };
    } else if (!error.response) {
      error.response = { data: { message: 'Cannot reach the SecureLend server. Check your connection and try again.' } };
    }
    return Promise.reject(error);
  }
);

export default api;
