import { useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { ApiErrorHandler, ApiError } from '../utils/apiErrorHandler';

interface UseApiErrorHandlerOptions {
  showToast?: boolean;
  logErrors?: boolean;
  onError?: (error: ApiError) => void;
  onRetryableError?: (error: ApiError) => void;
  onAuthError?: (error: ApiError) => void;
}

export const useApiErrorHandler = (options: UseApiErrorHandlerOptions = {}) => {
  const {
    showToast = true,
    logErrors = true,
    onError,
    onRetryableError,
    onAuthError
  } = options;

  const { addToast } = useToast();

  const handleError = useCallback((error: any, context?: string) => {
    const apiError = ApiErrorHandler.extractError(error);

    // Log error if enabled
    if (logErrors) {
      console.error(ApiErrorHandler.formatForLogging(apiError, context));
    }

    // Show toast notification if enabled
    if (showToast) {
      const message = ApiErrorHandler.getUserFriendlyMessage(apiError.code);
      
      addToast({
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message,
        duration: ApiErrorHandler.isRetryableError(apiError) ? 7000 : 5000
      });
    }

    // Handle specific error types
    if (ApiErrorHandler.requiresAuth(apiError) && onAuthError) {
      onAuthError(apiError);
    } else if (ApiErrorHandler.isRetryableError(apiError) && onRetryableError) {
      onRetryableError(apiError);
    }

    // Call custom error handler
    if (onError) {
      onError(apiError);
    }

    return apiError;
  }, [addToast, showToast, logErrors, onError, onRetryableError, onAuthError]);

  const handleSuccess = useCallback((message: string, title: string = 'สำเร็จ') => {
    if (showToast) {
      addToast({
        type: 'success',
        title,
        message,
        duration: 3000
      });
    }
  }, [addToast, showToast]);

  const handleWarning = useCallback((message: string, title: string = 'คำเตือน') => {
    if (showToast) {
      addToast({
        type: 'warning',
        title,
        message,
        duration: 5000
      });
    }
  }, [addToast, showToast]);

  const handleInfo = useCallback((message: string, title: string = 'ข้อมูล') => {
    if (showToast) {
      addToast({
        type: 'info',
        title,
        message,
        duration: 4000
      });
    }
  }, [addToast, showToast]);

  return {
    handleError,
    handleSuccess,
    handleWarning,
    handleInfo,
    isRetryableError: ApiErrorHandler.isRetryableError,
    requiresAuth: ApiErrorHandler.requiresAuth,
    getUserFriendlyMessage: ApiErrorHandler.getUserFriendlyMessage
  };
};