import React from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * PermissionGuard Component
 * Conditionally renders children based on user permissions
 */
const PermissionGuard = ({ 
  permission, 
  role, 
  roles, 
  children, 
  fallback = null,
  showFallback = false 
}) => {
  const { canDo, hasRole, hasAnyRole, isAuthenticated } = useAuth();

  // If not authenticated, don't show anything unless explicitly requested
  if (!isAuthenticated) {
    return showFallback ? fallback : null;
  }

  // Check permission-based access
  if (permission && !canDo(permission)) {
    return showFallback ? fallback : null;
  }

  // Check single role access
  if (role && !hasRole(role)) {
    return showFallback ? fallback : null;
  }

  // Check multiple roles access
  if (roles && !hasAnyRole(roles)) {
    return showFallback ? fallback : null;
  }

  // If all checks pass, render children
  return children;
};

/**
 * Hook for checking permissions in components
 */
export const usePermissions = () => {
  const { canDo, hasRole, hasAnyRole, permissions, user } = useAuth();

  return {
    canDo,
    hasRole,
    hasAnyRole,
    permissions,
    user,
    // Convenience methods for common checks
    canUploadFiles: () => canDo('can_upload_files'),
    canCreateFolders: () => canDo('can_create_folders'),
    canDeleteFiles: () => canDo('can_delete_files'),
    canCreateForumTopics: () => canDo('can_create_forum_topics'),
    canDeleteForumPosts: () => canDo('can_delete_forum_posts'),
    canAccessAdminDashboard: () => canDo('can_access_admin_dashboard'),
    canManageUsers: () => canDo('can_manage_users'),
    canViewAnalytics: () => canDo('can_view_analytics'),
    isAdmin: () => hasRole('admin'),
    isStaff: () => hasRole('staff'),
    isGuest: () => hasRole('guest'),
    isStaffOrAdmin: () => hasAnyRole(['staff', 'admin'])
  };
};

export default PermissionGuard;

