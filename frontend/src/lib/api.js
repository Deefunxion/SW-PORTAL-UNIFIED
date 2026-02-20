import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

// auto-attach JWT
api.interceptors.request.use(config => {
  const token = Cookies.get('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// auto-redirect to login on 401 (expired/invalid JWT)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/ΟΠΣΚΜ-UNIFIED/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;