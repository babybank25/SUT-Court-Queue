import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { SocketProvider } from '../../contexts/SocketContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { RealtimeDataProvider } from '../../contexts/RealtimeDataContext';

// Mock Socket.IO with advanced functionality
const createMockSocket = () => {
  const eventHandlers: { [key: string]: Function[] } = {};
  
  return {
    id: 'mock-socket-id',
    connected: true,
    emit: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    }),
    off: vi.fn((event: string, handler?: Function) => {
      if (handler && eventHandlers[event]) {
        const index = eventHandlers[event].indexOf(handler);
        if (index > -1) {
          eventHandlers[event].splice(index, 1);
        }
      } else if (eventHandlers[event]) {
        eventHandlers[event] = [];
      }
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    // Helper methods for testing
    _trigger: (event: string, data: any) => {
      if (eventHandlers[event]) {
        eventHandlers[event].forEach(handler => handler(data));
      }
    },
    _getHandlers: () => eventHandlers,
    _setConnected: (connected: boolean) => {
      this.connected = connected;
    }
  };
};

let mockSocket = createMockSocket();

const mockUseSocket = vi.fn();
vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => mockUseSocket(),
}));

// Mock fetch
global.fetch = vi.fn();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <RealtimeDataProvider>
            {children}
          </RealtimeDataProvider>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('Real-time Multi-Component Integration Tests', () => {
  beforeEach(() => {
    mockSocket = createMockSocket();
    mockUseSocket.mockReturnValue({
      socket: mockSocket,
      isConnected: true,
      emit: mockSocket.emit,
      on: mockSocket.on,
      off: mockSocket.off,
    });

    // Mock default API responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/queue')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              teams: [],
              totalTeams: 0,
              availableSlots: 10,
              maxSize: 10
            }
          })
        });
      }
      if (url.includes('/api/match/current')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              matches: [],
              hasActiveMatch: false
            }
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

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Cross-Component Real-time Synchronization', () => {
    it('should synchronize queue updates across all components', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Start on Public Queue tab
      await waitFor(() => {
        expect(screen.getByText('Public Queue')).toBeInTheDocument();
      });

      // Verify initial empty state
      await waitFor(() => {
        expect(screen.getByText(/queue is empty/i)).toBeInTheDocument();
      });

      // Simulate real-time queue update
      act(() => {
        mockSocket._trigger('queue-updated', {
          teams: [
            {
              id: '1',
              name: 'Real-time Team Alpha',
              members: 5,
              status: 'waiting',
              wins: 2,
              lastSeen: new Date().toISOString(),
              position: 1,
              contactInfo: 'alpha@test.com'
            },
            {
              id: '2',
              name: 'Real-time Team Beta',
              members: 4,
              status: 'waiting',
              wins: 1,
              lastSeen: new Date().toISOString(),
              position: 2,
              contactInfo: 'beta@test.com'
            }
          ],
          totalTeams: 2,
          availableSlots: 8,
          event: 'team_joined'
        });
      });

      // Verify queue display updates
      await waitFor(() => {
        expect(screen.getByText('Real-time Team Alpha')).toBeInTheDocument();
        expect(screen.getByText('Real-time Team Beta')).toBeInTheDocument();
        expect(screen.getByText('2 teams waiting')).toBeInTheDocument();
      });

      // Switch to Match View
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      // Should show no active match initially
      await waitFor(() => {
        expect(screen.getByText(/no active match/i)).toBeInTheDocument();
      });

      // Switch to Admin tab (should show login)
      const adminTab = screen.getByText('Admin');
      await user.click(adminTab);

      await waitFor(() => {
        expect(screen.getByText('Admin Login')).toBeInTheDocument();
      });

      // Switch back to Public Queue
      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      // Queue data should still be there (maintained by context)
      await waitFor(() => {
        expect(screen.getByText('Real-time Team Alpha')).toBeInTheDocument();
        expect(screen.getByText('Real-time Team Beta')).toBeInTheDocument();
      });
    });

    it('should handle match lifecycle updates across components', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Start with teams in queue
      act(() => {
        mockSocket._trigger('queue-updated', {
          teams: [
            {
              id: '1',
              name: 'Match Team 1',
              members: 5,
              status: 'waiting',
              wins: 0,
              lastSeen: new Date().toISOString(),
              position: 1
            },
            {
              id: '2',
              name: 'Match Team 2',
              members: 4,
              status: 'waiting',
              wins: 0,
              lastSeen: new Date().toISOString(),
              position: 2
            }
          ],
          totalTeams: 2,
          availableSlots: 8,
          event: 'teams_ready'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Match Team 1')).toBeInTheDocument();
      });

      // Switch to Match View
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      // Simulate match start
      act(() => {
        mockSocket._trigger('match-updated', {
          event: 'match_started',
          match: {
            id: 'match-1',
            team1: {
              id: '1',
              name: 'Match Team 1',
              members: 5,
              status: 'playing',
              wins: 0,
              lastSeen: new Date().toISOString()
            },
            team2: {
              id: '2',
              name: 'Match Team 2',
              members: 4,
              status: 'playing',
              wins: 0,
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
          }
        });
      });

      // Should show active match
      await waitFor(() => {
        expect(screen.getByText('Match Team 1')).toBeInTheDocument();
        expect(screen.getByText('Match Team 2')).toBeInTheDocument();
        expect(screen.getByText('0 - 0')).toBeInTheDocument();
        expect(screen.getByText('Live Match')).toBeInTheDocument();
      });

      // Simulate score updates
      act(() => {
        mockSocket._trigger('match-updated', {
          event: 'score_updated',
          match: {
            id: 'match-1',
            team1: { id: '1', name: 'Match Team 1', members: 5, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'Match Team 2', members: 4, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
            score1: 10,
            score2: 8,
            status: 'active',
            startTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: false, team2: false }
          },
          score: '10-8'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('10 - 8')).toBeInTheDocument();
      });

      // Switch back to queue view
      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      // Queue should reflect that teams are now playing
      act(() => {
        mockSocket._trigger('queue-updated', {
          teams: [],
          totalTeams: 0,
          availableSlots: 10,
          event: 'match_started'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/queue is empty/i)).toBeInTheDocument();
      });

      // Switch back to match view
      await user.click(matchTab);

      // Match should still be active
      await waitFor(() => {
        expect(screen.getByText('10 - 8')).toBeInTheDocument();
      });
    });

    it('should handle match completion and confirmation flow', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Navigate to Match View
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      // Start with active match near completion
      act(() => {
        mockSocket._trigger('match-updated', {
          event: 'match_active',
          match: {
            id: 'completion-match',
            team1: { id: '1', name: 'Completion Team 1', members: 5, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'Completion Team 2', members: 4, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
            score1: 20,
            score2: 18,
            status: 'active',
            startTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: false, team2: false }
          }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('20 - 18')).toBeInTheDocument();
      });

      // Simulate match reaching target score
      act(() => {
        mockSocket._trigger('match-updated', {
          event: 'match_ended',
          match: {
            id: 'completion-match',
            team1: { id: '1', name: 'Completion Team 1', members: 5, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'Completion Team 2', members: 4, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
            score1: 21,
            score2: 18,
            status: 'confirming',
            startTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: false, team2: false }
          }
        });
      });

      // Should show confirmation UI
      await waitFor(() => {
        expect(screen.getByText('21 - 18')).toBeInTheDocument();
        expect(screen.getByText('Awaiting Confirmation')).toBeInTheDocument();
        expect(screen.getByText('Confirm Result')).toBeInTheDocument();
      });

      // Simulate partial confirmation
      act(() => {
        mockSocket._trigger('match-updated', {
          event: 'confirmation_received',
          match: {
            id: 'completion-match',
            team1: { id: '1', name: 'Completion Team 1', members: 5, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'Completion Team 2', members: 4, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
            score1: 21,
            score2: 18,
            status: 'confirming',
            startTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: true, team2: false }
          },
          confirmationStatus: {
            team1Confirmed: true,
            team2Confirmed: false,
            waitingFor: 'Completion Team 2'
          }
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/waiting for.*completion team 2/i)).toBeInTheDocument();
      });

      // Simulate full confirmation and completion
      act(() => {
        mockSocket._trigger('match-updated', {
          event: 'match_completed',
          match: {
            id: 'completion-match',
            team1: { id: '1', name: 'Completion Team 1', members: 5, status: 'cooldown', wins: 1, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'Completion Team 2', members: 4, status: 'waiting', wins: 0, lastSeen: new Date().toISOString() },
            score1: 21,
            score2: 18,
            status: 'completed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: true, team2: true }
          },
          winner: 'Completion Team 1',
          finalScore: '21-18'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Match Completed')).toBeInTheDocument();
        expect(screen.getByText('Winner: Completion Team 1')).toBeInTheDocument();
        expect(screen.getByText('Final Score: 21-18')).toBeInTheDocument();
      });

      // Switch to queue view to see updated state
      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      // Simulate queue update after match completion
      act(() => {
        mockSocket._trigger('queue-updated', {
          teams: [
            {
              id: '1',
              name: 'Completion Team 1',
              members: 5,
              status: 'cooldown',
              wins: 1,
              lastSeen: new Date().toISOString(),
              position: 1
            },
            {
              id: '2',
              name: 'Completion Team 2',
              members: 4,
              status: 'waiting',
              wins: 0,
              lastSeen: new Date().toISOString(),
              position: 2
            }
          ],
          totalTeams: 2,
          availableSlots: 8,
          event: 'match_completed'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Completion Team 1')).toBeInTheDocument();
        expect(screen.getByText('Completion Team 2')).toBeInTheDocument();
        expect(screen.getByText('1 win')).toBeInTheDocument();
      });
    });

    it('should handle court status updates across all components', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Initial court status should be loaded
      await waitFor(() => {
        expect(screen.getByText(/court open/i)).toBeInTheDocument();
      });

      // Simulate court status change
      act(() => {
        mockSocket._trigger('court-status', {
          isOpen: false,
          currentTime: new Date().toISOString(),
          timezone: 'Asia/Bangkok',
          mode: 'maintenance',
          activeMatches: 0,
          message: 'Court closed for maintenance'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/court closed/i)).toBeInTheDocument();
        expect(screen.getByText(/maintenance/i)).toBeInTheDocument();
      });

      // Switch to Match View
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      // Court status should be consistent
      await waitFor(() => {
        expect(screen.getByText(/court closed/i)).toBeInTheDocument();
      });

      // Switch back to queue
      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      // Court status should still be consistent
      await waitFor(() => {
        expect(screen.getByText(/court closed/i)).toBeInTheDocument();
      });

      // Simulate court reopening
      act(() => {
        mockSocket._trigger('court-status', {
          isOpen: true,
          currentTime: new Date().toISOString(),
          timezone: 'Asia/Bangkok',
          mode: 'champion-return',
          activeMatches: 1,
          cooldownEnd: new Date(Date.now() + 300000).toISOString() // 5 minutes from now
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/court open/i)).toBeInTheDocument();
        expect(screen.getByText(/champion return/i)).toBeInTheDocument();
      });
    });

    it('should handle connection status changes across components', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Initially connected
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // Simulate disconnection
      mockUseSocket.mockReturnValue({
        socket: null,
        isConnected: false,
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      });

      act(() => {
        mockSocket._trigger('disconnect', 'transport close');
      });

      // Should show disconnected state
      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });

      // Switch tabs - disconnected state should persist
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });

      // Simulate reconnection
      mockSocket = createMockSocket();
      mockUseSocket.mockReturnValue({
        socket: mockSocket,
        isConnected: true,
        emit: mockSocket.emit,
        on: mockSocket.on,
        off: mockSocket.off,
      });

      act(() => {
        mockSocket._trigger('connect');
      });

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('should handle notification events across components', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Simulate various notification types
      const notifications = [
        {
          type: 'success',
          title: 'Team Joined',
          message: 'Team Alpha successfully joined the queue',
          duration: 3000
        },
        {
          type: 'warning',
          title: 'Court Closing Soon',
          message: 'Court will close in 10 minutes',
          duration: 5000
        },
        {
          type: 'error',
          title: 'Connection Error',
          message: 'Failed to update match score',
          duration: 4000
        },
        {
          type: 'info',
          title: 'Match Update',
          message: 'New match starting in 2 minutes',
          duration: 3000
        }
      ];

      for (const notification of notifications) {
        act(() => {
          mockSocket._trigger('notification', notification);
        });

        await waitFor(() => {
          expect(screen.getByText(notification.title)).toBeInTheDocument();
          expect(screen.getByText(notification.message)).toBeInTheDocument();
        });

        // Switch tabs to ensure notifications persist
        const matchTab = screen.getByText('Match View');
        await user.click(matchTab);

        // Notification should still be visible
        expect(screen.getByText(notification.title)).toBeInTheDocument();

        const queueTab = screen.getByText('Public Queue');
        await user.click(queueTab);

        // Wait for notification to disappear (or manually dismiss)
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    it('should handle rapid successive updates without UI glitches', async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Simulate rapid queue updates
      const rapidUpdates = Array.from({ length: 10 }, (_, i) => ({
        teams: Array.from({ length: i + 1 }, (_, j) => ({
          id: `${j + 1}`,
          name: `Rapid Team ${j + 1}`,
          members: 5,
          status: 'waiting',
          wins: 0,
          lastSeen: new Date().toISOString(),
          position: j + 1
        })),
        totalTeams: i + 1,
        availableSlots: 10 - (i + 1),
        event: 'rapid_update'
      }));

      // Send updates rapidly
      rapidUpdates.forEach((update, index) => {
        setTimeout(() => {
          act(() => {
            mockSocket._trigger('queue-updated', update);
          });
        }, index * 50);
      });

      // Wait for all updates to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should show final state
      await waitFor(() => {
        expect(screen.getByText('10 teams waiting')).toBeInTheDocument();
        expect(screen.getByText('Rapid Team 1')).toBeInTheDocument();
        expect(screen.getByText('Rapid Team 10')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle WebSocket errors gracefully across components', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Simulate WebSocket error
      act(() => {
        mockSocket._trigger('connect_error', new Error('Connection failed'));
      });

      await waitFor(() => {
        expect(screen.getByText(/connection error/i)).toBeInTheDocument();
      });

      // Error should be visible across different tabs
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      await waitFor(() => {
        expect(screen.getByText(/connection error/i)).toBeInTheDocument();
      });

      // Simulate recovery
      act(() => {
        mockSocket._trigger('connect');
      });

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('should maintain data consistency during error recovery', async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Set initial state
      act(() => {
        mockSocket._trigger('queue-updated', {
          teams: [
            {
              id: '1',
              name: 'Persistent Team',
              members: 5,
              status: 'waiting',
              wins: 0,
              lastSeen: new Date().toISOString(),
              position: 1
            }
          ],
          totalTeams: 1,
          availableSlots: 9,
          event: 'initial_state'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Persistent Team')).toBeInTheDocument();
      });

      // Simulate connection error
      mockUseSocket.mockReturnValue({
        socket: null,
        isConnected: false,
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      });

      act(() => {
        mockSocket._trigger('disconnect', 'transport error');
      });

      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });

      // Data should still be visible during disconnection
      expect(screen.getByText('Persistent Team')).toBeInTheDocument();

      // Simulate reconnection with updated data
      mockSocket = createMockSocket();
      mockUseSocket.mockReturnValue({
        socket: mockSocket,
        isConnected: true,
        emit: mockSocket.emit,
        on: mockSocket.on,
        off: mockSocket.off,
      });

      act(() => {
        mockSocket._trigger('connect');
        mockSocket._trigger('queue-updated', {
          teams: [
            {
              id: '1',
              name: 'Persistent Team',
              members: 5,
              status: 'waiting',
              wins: 1, // Updated wins
              lastSeen: new Date().toISOString(),
              position: 1
            },
            {
              id: '2',
              name: 'New Team',
              members: 4,
              status: 'waiting',
              wins: 0,
              lastSeen: new Date().toISOString(),
              position: 2
            }
          ],
          totalTeams: 2,
          availableSlots: 8,
          event: 'reconnect_sync'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
        expect(screen.getByText('Persistent Team')).toBeInTheDocument();
        expect(screen.getByText('New Team')).toBeInTheDocument();
        expect(screen.getByText('1 win')).toBeInTheDocument(); // Updated data
      });
    });
  });
});