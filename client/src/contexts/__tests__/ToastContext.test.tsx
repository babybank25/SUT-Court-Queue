import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastContext';

// Test component that uses the toast context
const TestComponent: React.FC = () => {
  const { toasts, addToast, removeToast, clearToasts } = useToast();

  return (
    <div>
      <div data-testid="toast-count">{toasts.length}</div>
      
      <button onClick={() => addToast({
        type: 'success',
        title: 'Success',
        message: 'Operation completed'
      })}>
        Add Success Toast
      </button>
      
      <button onClick={() => addToast({
        type: 'error',
        title: 'Error',
        message: 'Something went wrong',
        duration: 0 // Don't auto-dismiss
      })}>
        Add Error Toast
      </button>
      
      <button onClick={() => addToast({
        type: 'warning',
        title: 'Warning'
      })}>
        Add Warning Toast
      </button>
      
      <button onClick={() => addToast({
        type: 'info',
        title: 'Info',
        duration: 1000 // Short duration for testing
      })}>
        Add Info Toast
      </button>
      
      <button onClick={() => removeToast(toasts[0]?.id || '')}>
        Remove First Toast
      </button>
      
      <button onClick={clearToasts}>
        Clear All Toasts
      </button>
    </div>
  );
};

describe('ToastContext', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('provides initial empty state', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
  });

  it('adds success toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Success Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('adds error toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Error Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('adds warning toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Warning Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('adds info toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Info Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  it('auto-removes toast after duration', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Info Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });
  });

  it('does not auto-remove toast with duration 0', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Error Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
  });

  it('removes specific toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Success Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

    act(() => {
      screen.getByText('Remove First Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
  });

  it('clears all toasts', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Success Toast').click();
      screen.getByText('Add Error Toast').click();
      screen.getByText('Add Warning Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('3');

    act(() => {
      screen.getByText('Clear All Toasts').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
  });

  it('allows manual toast removal via close button', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Success Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

    // Find and click the close button
    const closeButton = screen.getByRole('button', { name: '' }); // SVG close button
    act(() => {
      closeButton.click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
  });

  it('handles multiple toasts', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Success Toast').click();
      screen.getByText('Add Error Toast').click();
      screen.getByText('Add Warning Toast').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('3');
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within a ToastProvider');

    console.error = originalError;
  });
});