import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { SocketProvider } from '../../contexts/SocketContext';
import { RealtimeDataProvider } from '../../contexts/RealtimeDataContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { PublicQueue } from '../../pages/PublicQueue';
import { MatchView } from '../../pages/MatchView';
import { io } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client');
const mockIo = io as jest.MockedFunction<typeof io>;

// Mock fetch
global.fetch = jest.fn();

// Create a mock socket
const createMockSocket = () => {
  const eventHandlers: { [key: string]: Function[] } = {};
  
  return {
    on: jest.fn((event: string, handler: Function) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    }),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
    id: 'mock-socket-id',
    // Helper to trigger events
    _trigger: (event: string, data: any) => {
      if (eventHandlers[event]) {
        eventHandlers[event].forEach(handler => handler(data));
      }
    },
    _getHandlers: () => eventHandlers
  };
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>
    <SocketProvider>
      <RealtimeDataProvider>
        {children}
      </RealtimeDataProvider>
    </SocketProvider>
  </ToastProvider>
);

describe('WebSocket Integration', () => {
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = createMockSocket();
    mockIo.mockReturnValue(mockSocket);

    // Mock initial API responses
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/queue')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              teams: [],
              totalTeams: 0,
              availableSlots: 10
            }
          })
        });
      }
      if (url.includes('/api/match/current')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { matches: [] }
          })
        });
      }
      if (url.includes('/api/court/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              isOpen: true,
              currentTime: new Date().toISOString(),
              timezone: 'Asia/Bangkok',
              mode: 'regular',
              activeMatches: 0
            }
          })
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  it('establishes WebSocket connection and receives queue updates', async () => {
    render(
      <TestWrapper>
        <PublicQueue />
      </TestWrapper>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText(/queue is empty/i)).toBeInTheDocument();
    });

    // Simulate queue update from WebSocket
    const queueUpdate = {
      teams: [
        {
          id: '1',
          name: 'Team Alpha',
          members: 5,
          status: 'waiting',
          wins: 0,
          lastSeen: new Date().toISOString(),
          position: 1
        }
      ],
      totalTeams: 1,
      availableSlots: 9,
      event: 'team_joined'
    };

    act(() => {
      mockSocket._trigger('queue-updated', queueUpdate);
    });

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
      expect(screen.getByText('Position: 1')).toBeInTheDocument();
    });
  });

  it('receives and displays match updates in real-time', async () => {
    render(
      <TestWrapper>
        <MatchView />
      </TestWrapper>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText(/no active match/i)).toBeInTheDocument();
    });

    // Simulate match start
    const matchUpdate = {
      match: {
        id: 'match-1',
        team1: {
          id: '1',
          name: 'Team Alpha',
          members: 5,
          status: 'playing',
          wins: 0,
          lastSeen: new Date().toISOString()
        },
        team2: {
          id: '2',
          name: 'Team Beta',
          members: 4,
          status: 'playing',
          wins: 1,
          lastSeen: new Date().toISOString()
        },
        score1: 0,
        score2: 0,
        status: 'active',
        startTime: new Date().toISOString(),
        targetScore: 21,
        matchType: 'regular',
        confirmed: {
          team1: false,
          team2: false
        }
      },
      event: 'match_started'
    };

    act(() => {
      mockSocket._trigger('match-updated', matchUpdate);
    });

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
      expect(screen.getByText('Team Beta')).toBeInTheDocument();
      expect(screen.getByText('0 - 0')).toBeInTheDocument();
    });

    // Simulate score update
    const scoreUpdate = {
      ...matchUpdate,
      match: {
        ...matchUpdate.match,
        score1: 5,
        score2: 3
      },
      event: 'score_updated',
      score: '5-3'
    };

    act(() => {
      mockSocket._trigger('match-updated', scoreUpdate);
    });

    await waitFor(() => {
      expect(screen.getByText('5 - 3')).toBeInTheDocument();
    });
  });

  it('handles WebSocket connection errors gracefully', async () => {
    render(
      <TestWrapper>
        <PublicQueue />
      </TestWrapper>
    );

    // Simulate connection error
    act(() => {
      mockSocket._trigger('connect_error', new Error('Connection failed'));
    });

    await waitFor(() => {
      expect(screen.getByText(/connection error/i)).toBeInTheDocument();
    });
  });

  it('handles WebSocket disconnection and reconnection', async () => {
    render(
      <TestWrapper>
        <PublicQueue />
      </TestWrapper>
    );

    // Simulate disconnection
    mockSocket.connected = false;
    act(() => {
      mockSocket._trigger('disconnect', 'transport close');
    });

    await waitFor(() => {
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    });

    // Simulate reconnection
    mockSocket.connected = true;
    act(() => {
      mockSocket._trigger('connect');
    });

    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });

  it('receives court status updates', async () => {
    render(
      <TestWrapper>
        <PublicQueue />
      </TestWrapper>
    );

    // Simulate court status update
    const courtStatusUpdate = {
      isOpen: false,
      currentTime: new Date().toISOString(),
      timezone: 'Asia/Bangkok',
      mode: 'regular',
      activeMatches: 0
    };

    act(() => {
      mockSocket._trigger('court-status', courtStatusUpdate);
    });

    await waitFor(() => {
      expect(screen.getByText(/court closed/i)).toBeInTheDocument();
    });
  });

  it('handles multiple simultaneous updates', async () => {
    render(
      <TestWrapper>
        <PublicQueue />
      </TestWrapper>
    );

    // Simulate multiple updates at once
    const queueUpdate = {
      teams: [
        {
          id: '1',
          name: 'Team Alpha',
          members: 5,
          status: 'waiting',
          wins: 0,
          lastSeen: new Date().toISOString(),
          position: 1
        },
        {
          id: '2',
          name: 'Team Beta',
          members: 4,
          status: 'waiting',
          wins: 1,
          lastSeen: new Date().toISOString(),
          position: 2
        }
      ],
      totalTeams: 2,
      availableSlots: 8
    };

    const courtStatusUpdate = {
      isOpen: true,
      currentTime: new Date().toISOString(),
      timezone: 'Asia/Bangkok',
      mode: 'champion-return',
      activeMatches: 1
    };

    act(() => {
      mockSocket._trigger('queue-updated', queueUpdate);
      mockSocket._trigger('court-status', courtStatusUpdate);
    });

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
      expect(screen.getByText('Team Beta')).toBeInTheDocument();
      expect(screen.getByText(/champion return/i)).toBeInTheDocument();
    });
  });

  it('emits events to server', async () => {
    render(
      <TestWrapper>
        <PublicQueue />
      </TestWrapper>
    );

    // Wait for connection
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    // The socket should be set up with event listeners
    const handlers = mockSocket._getHandlers();
    expect(handlers['queue-updated']).toBeDefined();
    expect(handlers['match-updated']).toBeDefined();
    expect(handlers['court-status']).toBeDefined();
    expect(handlers['connect']).toBeDefined();
    expect(handlers['disconnect']).toBeDefined();
    expect(handlers['connect_error']).toBeDefined();
  });

  it('handles notification events', async () => {
    render(
      <TestWrapper>
        <PublicQueue />
      </TestWrapper>
    );

    // Simulate notification
    const notification = {
      type: 'info',
      title: 'System Notification',
      message: 'Court will close in 10 minutes',
      duration: 5000
    };

    act(() => {
      mockSocket._trigger('notification', notification);
    });

    await waitFor(() => {
      expect(screen.getByText('System Notification')).toBeInTheDocument();
      expect(screen.getByText('Court will close in 10 minutes')).toBeInTheDocument();
    });
  });

  it('maintains connection state across component unmounts', async () => {
    const { unmount } = render(
      <TestWrapper>
        <PublicQueue />
      </TestWrapper>
    );

    // Verify connection is established
    expect(mockSocket.on).toHaveBeenCalled();

    // Unmount component
    unmount();

    // Socket should still be connected (managed by context)
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
  });

  it('handles rapid successive updates without race conditions', async () => {
    render(
      <TestWrapper>
        <MatchView />
      </TestWrapper>
    );

    const baseMatch = {
      id: 'match-1',
      team1: { id: '1', name: 'Team Alpha', members: 5, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
      team2: { id: '2', name: 'Team Beta', members: 4, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
      score1: 0,
      score2: 0,
      status: 'active',
      startTime: new Date().toISOString(),
      targetScore: 21,
      matchType: 'regular',
      confirmed: { team1: false, team2: false }
    };

    // Simulate rapid score updates
    act(() => {
      for (let i = 1; i <= 5; i++) {
        mockSocket._trigger('match-updated', {
          match: { ...baseMatch, score1: i, score2: i - 1 },
          event: 'score_updated',
          score: `${i}-${i - 1}`
        });
      }
    });

    await waitFor(() => {
      expect(screen.getByText('5 - 4')).toBeInTheDocument();
    });
  });
});