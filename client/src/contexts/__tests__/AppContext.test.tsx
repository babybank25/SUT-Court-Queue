import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AppProvider, useApp } from '../AppContext';
import { Team, Match, CourtStatus } from '../../types';

// Test component that uses the context
const TestComponent: React.FC = () => {
  const { state, actions } = useApp();

  return (
    <div>
      <div data-testid="queue-length">{state.queue.length}</div>
      <div data-testid="is-loading">{state.isLoading.toString()}</div>
      <div data-testid="error">{state.error || 'no error'}</div>
      <div data-testid="is-admin">{state.user.isAdmin.toString()}</div>
      
      <button onClick={() => actions.setLoading(true)}>Set Loading</button>
      <button onClick={() => actions.setError('Test error')}>Set Error</button>
      <button onClick={() => actions.clearError()}>Clear Error</button>
      <button onClick={() => actions.setUser({ isAdmin: true, token: 'test-token' })}>Set Admin</button>
    </div>
  );
};

describe('AppContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides initial state', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    expect(screen.getByTestId('queue-length')).toHaveTextContent('0');
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('no error');
    expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
  });

  it('updates loading state', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    act(() => {
      screen.getByText('Set Loading').click();
    });

    expect(screen.getByTestId('is-loading')).toHaveTextContent('true');
  });

  it('updates error state', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    act(() => {
      screen.getByText('Set Error').click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Test error');
  });

  it('clears error state', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    act(() => {
      screen.getByText('Set Error').click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Test error');

    act(() => {
      screen.getByText('Clear Error').click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('no error');
  });

  it('updates user state and manages localStorage', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    act(() => {
      screen.getByText('Set Admin').click();
    });

    expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
    expect(localStorage.getItem('adminToken')).toBe('test-token');
  });

  it('loads token from localStorage on initialization', () => {
    localStorage.setItem('adminToken', 'existing-token');

    const TestComponentWithToken: React.FC = () => {
      const { state } = useApp();
      return <div data-testid="token">{state.user.token || 'no token'}</div>;
    };

    render(
      <AppProvider>
        <TestComponentWithToken />
      </AppProvider>
    );

    expect(screen.getByTestId('token')).toHaveTextContent('existing-token');
  });

  it('updates queue state', () => {
    const TestComponentWithQueue: React.FC = () => {
      const { state, actions } = useApp();

      const mockTeams: Team[] = [
        {
          id: '1',
          name: 'Team A',
          members: 5,
          status: 'waiting',
          wins: 0,
          lastSeen: new Date(),
          position: 1
        },
        {
          id: '2',
          name: 'Team B',
          members: 4,
          status: 'waiting',
          wins: 1,
          lastSeen: new Date(),
          position: 2
        }
      ];

      return (
        <div>
          <div data-testid="queue-length">{state.queue.length}</div>
          <button onClick={() => actions.setQueue(mockTeams)}>Set Queue</button>
        </div>
      );
    };

    render(
      <AppProvider>
        <TestComponentWithQueue />
      </AppProvider>
    );

    expect(screen.getByTestId('queue-length')).toHaveTextContent('0');

    act(() => {
      screen.getByText('Set Queue').click();
    });

    expect(screen.getByTestId('queue-length')).toHaveTextContent('2');
  });

  it('updates current match state', () => {
    const TestComponentWithMatch: React.FC = () => {
      const { state, actions } = useApp();

      const mockMatch: Match = {
        id: 'match-1',
        team1: {
          id: '1',
          name: 'Team A',
          members: 5,
          status: 'playing',
          wins: 0,
          lastSeen: new Date()
        },
        team2: {
          id: '2',
          name: 'Team B',
          members: 4,
          status: 'playing',
          wins: 1,
          lastSeen: new Date()
        },
        score1: 10,
        score2: 8,
        status: 'active',
        startTime: new Date(),
        targetScore: 21,
        matchType: 'regular',
        confirmed: {
          team1: false,
          team2: false
        }
      };

      return (
        <div>
          <div data-testid="has-match">{state.currentMatch ? 'yes' : 'no'}</div>
          <button onClick={() => actions.setCurrentMatch(mockMatch)}>Set Match</button>
          <button onClick={() => actions.setCurrentMatch(null)}>Clear Match</button>
        </div>
      );
    };

    render(
      <AppProvider>
        <TestComponentWithMatch />
      </AppProvider>
    );

    expect(screen.getByTestId('has-match')).toHaveTextContent('no');

    act(() => {
      screen.getByText('Set Match').click();
    });

    expect(screen.getByTestId('has-match')).toHaveTextContent('yes');

    act(() => {
      screen.getByText('Clear Match').click();
    });

    expect(screen.getByTestId('has-match')).toHaveTextContent('no');
  });

  it('updates court status state', () => {
    const TestComponentWithCourtStatus: React.FC = () => {
      const { state, actions } = useApp();

      const mockCourtStatus: CourtStatus = {
        isOpen: true,
        currentTime: '2024-01-01T10:30:00Z',
        timezone: 'Asia/Bangkok',
        mode: 'regular',
        activeMatches: 1
      };

      return (
        <div>
          <div data-testid="court-open">{state.courtStatus?.isOpen ? 'open' : 'closed'}</div>
          <button onClick={() => actions.setCourtStatus(mockCourtStatus)}>Set Court Status</button>
        </div>
      );
    };

    render(
      <AppProvider>
        <TestComponentWithCourtStatus />
      </AppProvider>
    );

    expect(screen.getByTestId('court-open')).toHaveTextContent('closed');

    act(() => {
      screen.getByText('Set Court Status').click();
    });

    expect(screen.getByTestId('court-open')).toHaveTextContent('open');
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useApp must be used within an AppProvider');

    console.error = originalError;
  });
});