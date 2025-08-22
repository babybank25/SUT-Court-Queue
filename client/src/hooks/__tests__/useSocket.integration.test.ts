import { renderHook, act, waitFor } from '@testing-library/react';
import { io, Socket } from 'socket.io-client';
import { useSocket } from '../useSocket';
import { QueueUpdateData, MatchUpdateData, CourtStatusData, NotificationData } from '../../types';

// Mock socket.io-client
jest.mock('socket.io-client');
const mockIo = io as jest.MockedFunction<typeof io>;

describe('useSocket Integration Tests', () => {
  let mockSocket: Partial<Socket>;
  let eventHandlers: Record<string, Function>;

  beforeEach(() => {
    eventHandlers = {};
    
    mockSocket = {
      id: 'test-socket-id',
      connected: false,
      on: jest.fn((event: string, handler: Function) => {
        eventHandlers[event] = handler;
      }),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    };

    mockIo.mockReturnValue(mockSocket as Socket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should initialize socket connection with correct configuration', () => {
      renderHook(() => useSocket({
        serverUrl: 'http://test-server:3000',
        autoConnect: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 500
      }));

      expect(mockIo).toHaveBeenCalledWith('http://test-server:3000', {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 500,
        timeout: 10000,
        forceNew: true
      });
    });

    it('should handle connection events correctly', async () => {
      const { result } = renderHook(() => useSocket());

      // Simulate connection
      act(() => {
        eventHandlers.connect();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.connectionError).toBeNull();
      });

      // Verify that socket joins public room on connect
      expect(mockSocket.emit).toHaveBeenCalledWith('join-room', { room: 'public' });
    });

    it('should handle disconnection events correctly', async () => {
      const { result } = renderHook(() => useSocket());

      // First connect
      act(() => {
        eventHandlers.connect();
      });

      // Then disconnect
      act(() => {
        eventHandlers.disconnect('transport close');
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('should handle connection errors correctly', async () => {
      const { result } = renderHook(() => useSocket());

      const testError = new Error('Connection failed');
      
      act(() => {
        eventHandlers.connect_error(testError);
      });

      await waitFor(() => {
        expect(result.current.connectionError).toBe('Connection failed');
        expect(result.current.isConnected).toBe(false);
        expect(result.current.connectionStatus.reconnectAttempts).toBe(1);
      });
    });

    it('should handle reconnection events correctly', async () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        eventHandlers.reconnect(2);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.connectionError).toBeNull();
        expect(result.current.connectionStatus.reconnectAttempts).toBe(0);
      });
    });
  });

  describe('Event Handling', () => {
    it('should handle queue update events', async () => {
      const onQueueUpdate = jest.fn();
      const { result } = renderHook(() => useSocket());

      // Set up queue update listener
      act(() => {
        result.current.onQueueUpdate(onQueueUpdate);
      });

      const queueData: QueueUpdateData = {
        teams: [
          {
            id: '1',
            name: 'Test Team',
            members: 3,
            status: 'waiting',
            wins: 0,
            lastSeen: new Date(),
            position: 1
          }
        ],
        totalTeams: 1,
        availableSlots: 9,
        event: 'team_joined'
      };

      // Simulate queue update event
      act(() => {
        eventHandlers['queue-updated'](queueData);
      });

      expect(onQueueUpdate).toHaveBeenCalledWith(queueData);
    });

    it('should handle match update events', async () => {
      const onMatchUpdate = jest.fn();
      const { result } = renderHook(() => useSocket());

      // Set up match update listener
      act(() => {
        result.current.onMatchUpdate(onMatchUpdate);
      });

      const matchData: MatchUpdateData = {
        match: {
          id: 'match-1',
          team1: { id: '1', name: 'Team A', members: 3, status: 'playing', wins: 0, lastSeen: new Date() },
          team2: { id: '2', name: 'Team B', members: 3, status: 'playing', wins: 0, lastSeen: new Date() },
          score1: 10,
          score2: 8,
          status: 'active',
          startTime: new Date(),
          targetScore: 21,
          matchType: 'regular',
          confirmed: { team1: false, team2: false }
        },
        event: 'score_updated',
        score: '10-8'
      };

      // Simulate match update event
      act(() => {
        eventHandlers['match-updated'](matchData);
      });

      expect(onMatchUpdate).toHaveBeenCalledWith(matchData);
    });

    it('should handle court status events', async () => {
      const onCourtStatus = jest.fn();
      const { result } = renderHook(() => useSocket());

      // Set up court status listener
      act(() => {
        result.current.onCourtStatus(onCourtStatus);
      });

      const courtData: CourtStatusData = {
        isOpen: true,
        currentTime: new Date().toISOString(),
        timezone: 'Asia/Bangkok',
        mode: 'regular',
        activeMatches: 1
      };

      // Simulate court status event
      act(() => {
        eventHandlers['court-status'](courtData);
      });

      expect(onCourtStatus).toHaveBeenCalledWith(courtData);
    });

    it('should handle notification events', async () => {
      const onNotification = jest.fn();
      const { result } = renderHook(() => useSocket());

      // Set up notification listener
      act(() => {
        result.current.onNotification(onNotification);
      });

      const notificationData: NotificationData = {
        type: 'success',
        title: 'Team Joined',
        message: 'Successfully joined the queue',
        timestamp: new Date().toISOString(),
        duration: 5000
      };

      // Simulate notification event
      act(() => {
        eventHandlers['notification'](notificationData);
      });

      expect(onNotification).toHaveBeenCalledWith(notificationData);
    });
  });

  describe('Convenience Methods', () => {
    it('should emit join queue event correctly', () => {
      const { result } = renderHook(() => useSocket());

      // Simulate connection
      act(() => {
        eventHandlers.connect();
      });

      act(() => {
        result.current.joinQueue('Test Team', 3, 'test@example.com');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join-queue', {
        teamName: 'Test Team',
        members: 3,
        contactInfo: 'test@example.com'
      });
    });

    it('should emit confirm result event correctly', () => {
      const { result } = renderHook(() => useSocket());

      // Simulate connection
      act(() => {
        eventHandlers.connect();
      });

      act(() => {
        result.current.confirmResult('match-1', 'team-1', true);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('confirm-result', {
        matchId: 'match-1',
        teamId: 'team-1',
        confirmed: true
      });
    });

    it('should handle room management correctly', () => {
      const { result } = renderHook(() => useSocket());

      // Simulate connection
      act(() => {
        eventHandlers.connect();
      });

      // Join room
      act(() => {
        result.current.joinRoom('admin');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join-room', { room: 'admin' });

      // Leave room
      act(() => {
        result.current.leaveRoom('admin');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('leave-room', { room: 'admin' });
    });

    it('should not emit when disconnected', () => {
      const { result } = renderHook(() => useSocket());

      // Don't simulate connection, socket should be disconnected

      act(() => {
        result.current.joinQueue('Test Team', 3);
      });

      // Should not emit when disconnected
      expect(mockSocket.emit).not.toHaveBeenCalledWith('join-queue', expect.anything());
    });
  });

  describe('Manual Reconnection', () => {
    it('should allow manual reconnection', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.reconnect();
      });

      expect(mockSocket.connect).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup socket connection on unmount', () => {
      const { unmount } = renderHook(() => useSocket());

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle socket errors', async () => {
      const { result } = renderHook(() => useSocket());
      const onError = jest.fn();

      // Set up error listener
      act(() => {
        result.current.onError(onError);
      });

      const errorData = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data',
        details: { field: 'teamName' }
      };

      // Simulate error event
      act(() => {
        eventHandlers['error'](errorData);
      });

      expect(onError).toHaveBeenCalledWith(errorData);
    });
  });
});