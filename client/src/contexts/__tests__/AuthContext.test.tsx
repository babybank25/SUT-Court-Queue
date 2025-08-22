import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { ToastProvider } from '../ToastContext';

// Mock fetch
global.fetch = jest.fn();

const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>
    <AuthProvider>
      {children}
    </AuthProvider>
  </ToastProvider>
);

// Test component that uses the auth context
const TestComponent: React.FC = () => {
  const { state, login, logout, clearError } = useAuth();

  return (
    <div>
      <div data-testid="is-authenticated">{state.isAuthenticated.toString()}</div>
      <div data-testid="is-loading">{state.isLoading.toString()}</div>
      <div data-testid="error">{state.error || 'no error'}</div>
      <div data-testid="admin-name">{state.admin?.username || 'no admin'}</div>
      
      <button onClick={() => login('admin', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={clearError}>Clear Error</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('provides initial state', () => {
    render(
      <AuthWrapper>
        <TestComponent />
      </AuthWrapper>
    );

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('no error');
    expect(screen.getByTestId('admin-name')).toHaveTextContent('no admin');
  });

  it('handles successful login', async () => {
    const mockResponse = {
      success: true,
      data: {
        admin: {
          id: '1',
          username: 'admin',
          lastLogin: '2024-01-01T10:00:00Z'
        },
        token: 'mock-jwt-token'
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(
      <AuthWrapper>
        <TestComponent />
      </AuthWrapper>
    );

    act(() => {
      screen.getByText('Login').click();
    });

    // Should show loading state
    expect(screen.getByTestId('is-loading')).toHaveTextContent('true');

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    expect(screen.getByTestId('admin-name')).toHaveTextContent('admin');
    expect(localStorage.getItem('adminToken')).toBe('mock-jwt-token');
  });

  it('handles login failure', async () => {
    const mockResponse = {
      success: false,
      error: {
        message: 'Invalid credentials'
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => mockResponse
    });

    render(
      <AuthWrapper>
        <TestComponent />
      </AuthWrapper>
    );

    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
    });

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    expect(localStorage.getItem('adminToken')).toBeNull();
  });

  it('handles network error during login', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <AuthWrapper>
        <TestComponent />
      </AuthWrapper>
    );

    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Network error. Please try again.');
    });

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
  });

  it('handles logout', async () => {
    // First login
    const mockResponse = {
      success: true,
      data: {
        admin: {
          id: '1',
          username: 'admin'
        },
        token: 'mock-jwt-token'
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(
      <AuthWrapper>
        <TestComponent />
      </AuthWrapper>
    );

    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
    });

    // Then logout
    act(() => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('admin-name')).toHaveTextContent('no admin');
    expect(localStorage.getItem('adminToken')).toBeNull();
  });

  it('clears error state', async () => {
    const mockResponse = {
      success: false,
      error: {
        message: 'Test error'
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => mockResponse
    });

    render(
      <AuthWrapper>
        <TestComponent />
      </AuthWrapper>
    );

    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Test error');
    });

    act(() => {
      screen.getByText('Clear Error').click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('no error');
  });

  it('verifies existing token on mount', async () => {
    localStorage.setItem('adminToken', 'existing-token');

    // Mock successful token verification
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    });

    // Mock JWT token payload
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJ1c2VybmFtZSI6ImFkbWluIn0.signature';
    localStorage.setItem('adminToken', mockToken);

    render(
      <AuthWrapper>
        <TestComponent />
      </AuthWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('admin-name')).toHaveTextContent('admin');
  });

  it('handles token expiration', async () => {
    localStorage.setItem('adminToken', 'expired-token');

    // Mock token verification failure
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401
    });

    render(
      <AuthWrapper>
        <TestComponent />
      </AuthWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Session expired. Please log in again.');
    });

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
    expect(localStorage.getItem('adminToken')).toBeNull();
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    console.error = originalError;
  });
});