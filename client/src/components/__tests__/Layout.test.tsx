import React from 'react';
import { render, screen } from '@testing-library/react';
import { Layout } from '../Layout';
import { useApp } from '../../contexts/AppContext';

// Mock the useApp hook
jest.mock('../../contexts/AppContext');
const mockUseApp = useApp as jest.MockedFunction<typeof useApp>;

// Mock ConnectionStatus component
jest.mock('../ConnectionStatus', () => ({
  ConnectionStatus: () => <div data-testid="connection-status">Connected</div>
}));

describe('Layout', () => {
  const mockState = {
    queue: [],
    currentMatch: null,
    courtStatus: {
      isOpen: true,
      currentTime: '2024-01-01T10:30:00Z',
      timezone: 'Asia/Bangkok',
      mode: 'regular' as const,
      activeMatches: 0
    },
    isLoading: false,
    error: null,
    user: {
      isAdmin: false,
      token: null
    }
  };

  beforeEach(() => {
    mockUseApp.mockReturnValue({
      state: mockState,
      dispatch: jest.fn(),
      actions: {
        setQueue: jest.fn(),
        setCurrentMatch: jest.fn(),
        setCourtStatus: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
        setUser: jest.fn(),
        clearError: jest.fn()
      }
    });
  });

  it('renders header with title and description', () => {
    render(
      <Layout>
        <div>Test content</div>
      </Layout>
    );

    expect(screen.getByText('SUT Court Queue')).toBeInTheDocument();
    expect(screen.getByText('Basketball court queue management system')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <Layout>
        <div>Test content</div>
      </Layout>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('displays connection status', () => {
    render(
      <Layout>
        <div>Test content</div>
      </Layout>
    );

    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
  });

  it('displays current time when court status is available', () => {
    render(
      <Layout>
        <div>Test content</div>
      </Layout>
    );

    // Should display formatted time
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('displays error message when error exists', () => {
    mockUseApp.mockReturnValue({
      state: { ...mockState, error: 'Connection failed' },
      dispatch: jest.fn(),
      actions: {
        setQueue: jest.fn(),
        setCurrentMatch: jest.fn(),
        setCourtStatus: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
        setUser: jest.fn(),
        clearError: jest.fn()
      }
    });

    render(
      <Layout>
        <div>Test content</div>
      </Layout>
    );

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText('Reload')).toBeInTheDocument();
  });

  it('displays loading indicator when loading', () => {
    mockUseApp.mockReturnValue({
      state: { ...mockState, isLoading: true },
      dispatch: jest.fn(),
      actions: {
        setQueue: jest.fn(),
        setCurrentMatch: jest.fn(),
        setCourtStatus: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
        setUser: jest.fn(),
        clearError: jest.fn()
      }
    });

    render(
      <Layout>
        <div>Test content</div>
      </Layout>
    );

    expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
  });

  it('does not display time when court status is null', () => {
    mockUseApp.mockReturnValue({
      state: { ...mockState, courtStatus: null },
      dispatch: jest.fn(),
      actions: {
        setQueue: jest.fn(),
        setCurrentMatch: jest.fn(),
        setCourtStatus: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
        setUser: jest.fn(),
        clearError: jest.fn()
      }
    });

    render(
      <Layout>
        <div>Test content</div>
      </Layout>
    );

    expect(screen.queryByText(/\d{2}:\d{2}:\d{2}/)).not.toBeInTheDocument();
  });
});