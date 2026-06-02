import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
});

// Attach JWT to every request
API.interceptors.request.use(config => {
  const token = localStorage.getItem('estatepro_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — clear token and notify app
API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('estatepro_token');
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  }
);

export default API;
