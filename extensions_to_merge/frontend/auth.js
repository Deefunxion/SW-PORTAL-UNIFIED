import api from './api';
import Cookies from 'js-cookie';

// Enhanced authentication service
export const authService = {
  // Login function
  async login(username, password) {
    try {
      const { data } = await api.post('/api/auth/login', { username, password });
      
      // Store token with 7 days expiration
      Cookies.set('token', data.access_token, { 
        expires: 7,
        secure: window.location.protocol === 'https:',
        sameSite: 'strict'
      });
      
      // Store user info
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.message || 'Σφάλμα σύνδεσης');
    }
  },

  // Logout function
  logout() {
    try {
      // Remove token and user data
      Cookies.remove('token');
      localStorage.removeItem('user');
      
      // Clear any cached data
      sessionStorage.clear();
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  // Check if user is authenticated
  isAuthenticated() {
    const token = Cookies.get('token');
    return !!token;
  },

  // Get current user from localStorage
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  // Get user token
  getToken() {
    return Cookies.get('token');
  },

  // Check if user has specific role
  hasRole(role) {
    const user = this.getCurrentUser();
    return user?.role === role;
  },

  // Check if user has any of the specified roles
  hasAnyRole(roles) {
    const user = this.getCurrentUser();
    return roles.includes(user?.role);
  },

  // Verify token with backend
  async verifyToken() {
    try {
      const { data } = await api.get('/api/auth/verify');
      
      // Update user info if changed
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      return data;
    } catch (error) {
      console.error('Token verification failed:', error);
      this.logout();
      throw error;
    }
  },

  // Refresh token
  async refreshToken() {
    try {
      const { data } = await api.post('/api/auth/refresh');
      
      // Update token
      Cookies.set('token', data.access_token, { 
        expires: 7,
        secure: window.location.protocol === 'https:',
        sameSite: 'strict'
      });
      
      return data;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.logout();
      throw error;
    }
  }
};

// Backward compatibility - export individual functions
export async function login(username, password) {
  return authService.login(username, password);
}

export function logout() {
  return authService.logout();
}

export default authService;