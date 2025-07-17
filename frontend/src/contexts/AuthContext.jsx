import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '@/lib/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState({});

  // Fetch user permissions
  const fetchPermissions = async () => {
    try {
      const response = await authService.api('/api/user/permissions');
      setPermissions(response.permissions || {});
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions({});
    }
  };

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          // Get user from localStorage first
          const storedUser = authService.getCurrentUser();
          if (storedUser) {
            setUser(storedUser);
            setIsAuthenticated(true);
          }

          // Verify token with backend
          try {
            const verifyData = await authService.verifyToken();
            setUser(verifyData.user);
            setIsAuthenticated(true);
            await fetchPermissions();
          } catch (error) {
            // Token is invalid, clear auth state
            setUser(null);
            setIsAuthenticated(false);
            setPermissions({});
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username, password) => {
    try {
      setIsLoading(true);
      const response = await authService.login(username, password);
      setUser(response.user);
      setIsAuthenticated(true);
      await fetchPermissions();
      return response;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setPermissions({});
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setPermissions({});
      setIsLoading(false);
    }
  };

  const hasRole = (role) => {
    return authService.hasRole(role);
  };

  const hasAnyRole = (roles) => {
    return authService.hasAnyRole(roles);
  };

  const canDo = (permission) => {
    return permissions[permission] === true;
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    permissions,
    login,
    logout,
    hasRole,
    hasAnyRole,
    canDo,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;