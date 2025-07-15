import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, requiredRole = null, requiredRoles = null }) => {
  const { isAuthenticated, isLoading, hasRole, hasAnyRole } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">SW</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">SW Portal</h2>
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-gray-600">Έλεγχος πρόσβασης...</span>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access if required
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 font-bold text-xl">!</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Δεν έχετε πρόσβαση</h2>
          <p className="text-gray-600 mb-4">
            Δεν διαθέτετε τα απαραίτητα δικαιώματα για πρόσβαση σε αυτή τη σελίδα.
          </p>
          <p className="text-sm text-gray-500">
            Απαιτείται ρόλος: <span className="font-medium">{requiredRole}</span>
          </p>
        </div>
      </div>
    );
  }

  // Check multiple roles if required
  if (requiredRoles && !hasAnyRole(requiredRoles)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 font-bold text-xl">!</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Δεν έχετε πρόσβαση</h2>
          <p className="text-gray-600 mb-4">
            Δεν διαθέτετε τα απαραίτητα δικαιώματα για πρόσβαση σε αυτή τη σελίδα.
          </p>
          <p className="text-sm text-gray-500">
            Απαιτείται ένας από τους ρόλους: <span className="font-medium">{requiredRoles.join(', ')}</span>
          </p>
        </div>
      </div>
    );
  }

  // Render the protected component
  return children;
};

export default ProtectedRoute;
