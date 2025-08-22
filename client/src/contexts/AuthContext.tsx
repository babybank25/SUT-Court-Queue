import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { useToast } from './ToastContext';

// Types
interface AdminUser {
  id: string;
  username: string;
  lastLogin?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  admin: AdminUser | null;
  token: string | null;
  error: string | null;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { admin: AdminUser; token: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'TOKEN_EXPIRED' };

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  admin: null,
  token: localStorage.getItem('adminToken'),
  error: null,
};

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      localStorage.setItem('adminToken', action.payload.token);
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        admin: action.payload.admin,
        token: action.payload.token,
        error: null,
      };
    case 'LOGIN_FAILURE':
      localStorage.removeItem('adminToken');
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        admin: null,
        token: null,
        error: action.payload,
      };
    case 'LOGOUT':
    case 'TOKEN_EXPIRED':
      localStorage.removeItem('adminToken');
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        admin: null,
        token: null,
        error: action.type === 'TOKEN_EXPIRED' ? 'Session expired. Please log in again.' : null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Context
interface AuthContextType {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { showToast } = useToast();

  // Check token validity on mount
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      // Verify token with backend
      verifyToken(token);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Token is valid, but we don't have admin info from this endpoint
        // We'll need to extract it from the token or make another call
        const payload = JSON.parse(atob(token.split('.')[1]));
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            admin: {
              id: payload.id,
              username: payload.username,
            },
            token,
          },
        });
      } else if (response.status === 401 || response.status === 403) {
        dispatch({ type: 'TOKEN_EXPIRED' });
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      dispatch({ type: 'TOKEN_EXPIRED' });
    }
  };

  const login = async (username: string, password: string): Promise<void> => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            admin: data.data.admin,
            token: data.data.token,
          },
        });
        showToast('success', 'Login Successful', 'Welcome back!');
      } else {
        const errorMessage = data.error?.message || 'Login failed';
        dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
        showToast('error', 'Login Failed', errorMessage);
      }
    } catch (error) {
      const errorMessage = 'Network error. Please try again.';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      showToast('error', 'Login Failed', errorMessage);
    }
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
    showToast('info', 'Logged Out', 'You have been logged out successfully.');
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  return (
    <AuthContext.Provider value={{ state, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use the context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};