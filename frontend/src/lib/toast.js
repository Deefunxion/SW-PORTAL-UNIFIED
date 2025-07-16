import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

/**
 * Toast utility functions for consistent notifications across the app
 * Uses Sonner library with custom styling and icons
 */

// Success toast - for successful operations
export const showSuccessToast = (message, options = {}) => {
  return toast.success(message, {
    icon: <CheckCircle className="w-4 h-4" />,
    style: {
      background: '#f0fdf4',
      color: '#166534',
      border: '1px solid #bbf7d0',
    },
    ...options,
  });
};

// Error toast - for errors and failures
export const showErrorToast = (message, options = {}) => {
  return toast.error(message, {
    icon: <XCircle className="w-4 h-4" />,
    style: {
      background: '#fef2f2',
      color: '#dc2626',
      border: '1px solid #fecaca',
    },
    duration: 6000, // Longer duration for errors
    ...options,
  });
};

// Warning toast - for warnings and cautions
export const showWarningToast = (message, options = {}) => {
  return toast.warning(message, {
    icon: <AlertCircle className="w-4 h-4" />,
    style: {
      background: '#fffbeb',
      color: '#d97706',
      border: '1px solid #fed7aa',
    },
    ...options,
  });
};

// Info toast - for informational messages
export const showInfoToast = (message, options = {}) => {
  return toast.info(message, {
    icon: <Info className="w-4 h-4" />,
    style: {
      background: '#eff6ff',
      color: '#2563eb',
      border: '1px solid #bfdbfe',
    },
    ...options,
  });
};

// Loading toast - for ongoing operations
export const showLoadingToast = (message, options = {}) => {
  return toast.loading(message, {
    style: {
      background: '#f8fafc',
      color: '#475569',
      border: '1px solid #e2e8f0',
    },
    ...options,
  });
};

// Promise toast - for async operations
export const showPromiseToast = (promise, messages, options = {}) => {
  return toast.promise(promise, {
    loading: messages.loading || 'Φόρτωση...',
    success: messages.success || 'Επιτυχία!',
    error: messages.error || 'Σφάλμα!',
    ...options,
  });
};

// Custom toast with action button
export const showActionToast = (message, actionLabel, actionFn, options = {}) => {
  return toast(message, {
    action: {
      label: actionLabel,
      onClick: actionFn,
    },
    ...options,
  });
};

// Dismiss all toasts
export const dismissAllToasts = () => {
  toast.dismiss();
};

// Dismiss specific toast
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

// Default export with all functions
export default {
  success: showSuccessToast,
  error: showErrorToast,
  warning: showWarningToast,
  info: showInfoToast,
  loading: showLoadingToast,
  promise: showPromiseToast,
  action: showActionToast,
  dismiss: dismissToast,
  dismissAll: dismissAllToasts,
};
