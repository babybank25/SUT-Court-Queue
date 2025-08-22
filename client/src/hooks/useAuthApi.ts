import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export const useAuthApi = () => {
  const { state, logout } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const makeAuthenticatedRequest = async <T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    setIsLoading(true);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
          ...options.headers,
        },
      });

      const data = await response.json();

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        logout();
        showToast('error', 'Session Expired', 'Please log in again.');
        throw new Error('Authentication failed');
      }

      if (!response.ok) {
        const errorMessage = data.error?.message || 'Request failed';
        showToast('error', 'Request Failed', errorMessage);
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const get = <T = any>(url: string): Promise<ApiResponse<T>> => {
    return makeAuthenticatedRequest<T>(url, { method: 'GET' });
  };

  const post = <T = any>(url: string, body?: any): Promise<ApiResponse<T>> => {
    return makeAuthenticatedRequest<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  const put = <T = any>(url: string, body?: any): Promise<ApiResponse<T>> => {
    return makeAuthenticatedRequest<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  const del = <T = any>(url: string): Promise<ApiResponse<T>> => {
    return makeAuthenticatedRequest<T>(url, { method: 'DELETE' });
  };

  return {
    isLoading,
    get,
    post,
    put,
    delete: del,
    makeAuthenticatedRequest,
  };
};