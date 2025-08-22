import { useCallback, useEffect } from 'react';
import { useSocketContext } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';
import { SocketErrorData, NotificationData } from '../types';

interface UseSocketErrorHandlerOptions {
  onError?: (error: SocketErrorData) => void;
  onNotification?: (notification: NotificationData) => void;
  showToasts?: boolean;
  logErrors?: boolean;
}

export const useSocketErrorHandler = (options: UseSocketErrorHandlerOptions = {}) => {
  const { 
    onError, 
    onNotification, 
    showToasts = true,
    logErrors = true
  } = options;
  
  const { onError: socketOnError, onNotification: socketOnNotification } = useSocketContext();
  const { addToast } = useToast();

  // Handle socket errors
  const handleSocketError = useCallback((error: SocketErrorData) => {
    if (logErrors) {
      console.error('Socket Error:', error);
    }
    
    // Call custom error handler if provided
    if (onError) {
      onError(error);
    }
    
    // Show toast notification if enabled
    if (showToasts) {
      addToast({
        type: 'error',
        title: getErrorTitle(error.code),
        message: error.message,
        duration: 5000
      });
    }
    
    // Handle specific error types
    switch (error.code) {
      case 'VALIDATION_ERROR':
        if (logErrors) console.warn('Validation error details:', error.details);
        break;
      case 'TEAM_NAME_EXISTS':
        if (logErrors) console.warn('Team name conflict:', error.details?.teamName);
        break;
      case 'QUEUE_FULL':
        if (logErrors) console.warn('Queue capacity:', error.details);
        break;
      case 'MATCH_NOT_FOUND':
        if (logErrors) console.warn('Match ID:', error.details?.matchId);
        break;
      case 'MATCH_NOT_CONFIRMING':
        if (logErrors) console.warn('Match status:', error.details?.currentStatus);
        break;
      case 'TEAM_NOT_IN_MATCH':
        if (logErrors) console.warn('Team/Match mismatch:', error.details);
        break;
      case 'INTERNAL_ERROR':
        if (logErrors) console.error('Internal server error details:', error.details);
        break;
      case 'RATE_LIMIT_EXCEEDED':
        if (logErrors) console.warn('Rate limit exceeded, please slow down');
        break;
      case 'INVALID_ROOM':
        if (logErrors) console.warn('Invalid room:', error.details);
        break;
      case 'UNKNOWN_ACTION':
        if (logErrors) console.warn('Unknown admin action:', error.details);
        break;
      default:
        if (logErrors) console.warn('Unknown socket error code:', error.code);
    }
  }, [onError, showToasts, logErrors]);

  // Handle socket notifications
  const handleSocketNotification = useCallback((notification: NotificationData) => {
    if (logErrors) {
      console.log('Socket Notification:', notification);
    }
    
    // Call custom notification handler if provided
    if (onNotification) {
      onNotification(notification);
    }
    
    // Show toast notification if enabled
    if (showToasts) {
      addToast({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        duration: notification.duration || 4000
      });
    }
  }, [onNotification, showToasts, logErrors]);

  // Set up event listeners
  useEffect(() => {
    socketOnError(handleSocketError);
    socketOnNotification(handleSocketNotification);
    
    // Cleanup is handled by the socket context
    return () => {
      // Event listeners are automatically cleaned up by the socket context
    };
  }, [socketOnError, socketOnNotification, handleSocketError, handleSocketNotification]);

  // Helper function to get user-friendly error titles
  const getErrorTitle = useCallback((errorCode: string): string => {
    switch (errorCode) {
      case 'VALIDATION_ERROR':
        return 'Invalid Input';
      case 'TEAM_NAME_EXISTS':
        return 'Team Name Taken';
      case 'QUEUE_FULL':
        return 'Queue Full';
      case 'MATCH_NOT_FOUND':
        return 'Match Not Found';
      case 'MATCH_NOT_CONFIRMING':
        return 'Match Not Ready';
      case 'TEAM_NOT_IN_MATCH':
        return 'Team Not in Match';
      case 'INTERNAL_ERROR':
        return 'Server Error';
      case 'RATE_LIMIT_EXCEEDED':
        return 'Too Many Requests';
      case 'INVALID_ROOM':
        return 'Invalid Room';
      case 'UNKNOWN_ACTION':
        return 'Unknown Action';
      default:
        return 'Error';
    }
  }, []);

  // Helper function to get notification icons
  const getNotificationIcon = useCallback((type: string): string => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  }, []);

  return {
    handleSocketError,
    handleSocketNotification,
    getErrorTitle,
    getNotificationIcon
  };
};