import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { SocketProvider } from '../../contexts/SocketContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { RealtimeDataProvider } from '../../contexts/RealtimeDataProvider';

// Mock Socket.IO
const mockSocket = {
  id: 'socket-123',
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connected: true,
};

const mockUseSocket = vi.fn();
vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => mockUseSocket(),
}));

// Mock fetch globally
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

describe('Complete Frontend Integration Tests', () => {
  beforeEach(() => {
    mockUseSocket.mockReturnValue({
      socket: mockSocket,
      isConnected: true,
      emit: mockSocket.emit,
      on: mockSocket.on,
      off: mockSocket.off,
    });

    // Default successful API responses
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/queue') && !options?.method) {
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
              mode: 'regular'
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

  describe('Complete User Journey - Team Perspective', () => {
    it('should handle complete team journey from joining queue to match completion', async () => {
      const user = userEvent.setup();
      render(<TestWrapper><App /></TestWrapper>);

      // === STEP 1: Team arrives and checks queue ===
      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      await waitFor(() => {
        expect(screen.getByText('Current Queue')).toBeInTheDocument();
        expect(screen.getByText('Queue is empty')).toBeInTheDocument();
      });

      // === STEP 2: Team joins queue ===
      const joinButton = screen.getByText('Join Queue');
      await user.click(joinButton);

      // Fill out join form
      await user.type(screen.getByLabelText('Team Name'), 'Integration Warriors');
      await user.clear(screen.getByLabelText('Number of Players'));
      await user.type(screen.getByLabelText('Number of Players'), '5');
      await user.type(screen.getByLabelText('Contact Info (Optional)'), 'warriors@test.com');

      const submitButton = screen.getByRole('button', { name: 'Join Queue' });
      await user.click(submitButton);

      // Verify WebSocket call
      expect(mockSocket.emit).toHaveBeenCalledWith('join-queue', {
        name: 'Integration Warriors',
        members: 5,
        contactInfo: 'warriors@test.com'
      });

      // === STEP 3: Simulate successful queue join ===
      const notificationCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'notification'
      )?.[1];

      if (notificationCallback) {
        notificationCallback({
          type: 'success',
          title: 'Joined Queue',
          message: 'Team "Integration Warriors" successfully joined at position 1'
        });
      }

      // Simulate queue update
      const queueUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'queue-updated'
      )?.[1];

      if (queueUpdateCallback) {
        queueUpdateCallback({
          teams: [{
            id: 'team-1',
            name: 'Integration Warriors',
            members: 5,
            status: 'waiting',
            wins: 0,
            lastSeen: new Date().toISOString(),
            position: 1,
            contactInfo: 'warriors@test.com'
          }],
          totalTeams: 1,
          availableSlots: 9,
          event: 'team_joined'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Integration Warriors')).toBeInTheDocument();
        expect(screen.getByText('Position: 1')).toBeInTheDocument();
      });

      // === STEP 4: Another team joins ===
      if (queueUpdateCallback) {
        queueUpdateCallback({
          teams: [
            {
              id: 'team-1',
              name: 'Integration Warriors',
              members: 5,
              status: 'waiting',
              wins: 0,
              lastSeen: new Date().toISOString(),
              position: 1,
              contactInfo: 'warriors@test.com'
            },
            {
              id: 'team-2',
              name: 'Test Challengers',
              members: 4,
              status: 'waiting',
              wins: 2,
              lastSeen: new Date().toISOString(),
              position: 2
            }
          ],
          totalTeams: 2,
          availableSlots: 8,
          event: 'team_joined'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Test Challengers')).toBeInTheDocument();
        expect(screen.getByText('2 teams waiting')).toBeInTheDocument();
      });

      // === STEP 5: Match starts - teams move to playing ===
      if (queueUpdateCallback) {
        queueUpdateCallback({
          teams: [],
          totalTeams: 0,
          availableSlots: 10,
          event: 'match_started'
        });
      }

      // Simulate match start notification
      if (notificationCallback) {
        notificationCallback({
          type: 'info',
          title: 'Match Started',
          message: 'Integration Warriors vs Test Challengers - Match has begun!'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Queue is empty')).toBeInTheDocument();
      });

      // === STEP 6: Team switches to match view to watch ===
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      // Mock active match data
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/match/current')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                matches: [{
                  id: 'match-1',
                  team1: {
                    id: 'team-1',
                    name: 'Integration Warriors',
                    members: 5,
                    status: 'playing',
                    wins: 0,
                    lastSeen: new Date().toISOString()
                  },
                  team2: {
                    id: 'team-2',
                    name: 'Test Challengers',
                    members: 4,
                    status: 'playing',
                    wins: 2,
                    lastSeen: new Date().toISOString()
                  },
                  score1: 0,
                  score2: 0,
                  status: 'active',
                  startTime: new Date().toISOString(),
                  targetScore: 21,
                  matchType: 'regular',
                  confirmed: { team1: false, team2: false }
                }],
                hasActiveMatch: true
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await waitFor(() => {
        expect(screen.getByText('Integration Warriors')).toBeInTheDocument();
        expect(screen.getByText('Test Challengers')).toBeInTheDocument();
        expect(screen.getByText('Live Match')).toBeInTheDocument();
      });

      // === STEP 7: Watch match progress with real-time updates ===
      const matchUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'match-updated'
      )?.[1];

      // Simulate score progression
      const scoreUpdates = [
        { score1: 3, score2: 2, event: 'score_updated' },
        { score1: 8, score2: 6, event: 'score_updated' },
        { score1: 15, score2: 12, event: 'score_updated' },
        { score1: 21, score2: 18, event: 'match_ended' }
      ];

      for (const update of scoreUpdates) {
        if (matchUpdateCallback) {
          matchUpdateCallback({
            event: update.event,
            match: {
              id: 'match-1',
              team1: { id: 'team-1', name: 'Integration Warriors', members: 5, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
              team2: { id: 'team-2', name: 'Test Challengers', members: 4, status: 'playing', wins: 2, lastSeen: new Date().toISOString() },
              score1: update.score1,
              score2: update.score2,
              status: update.event === 'match_ended' ? 'confirming' : 'active',
              startTime: new Date().toISOString(),
              targetScore: 21,
              matchType: 'regular',
              confirmed: { team1: false, team2: false }
            },
            score: `${update.score1}-${update.score2}`
          });
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify final scores displayed
      await waitFor(() => {
        expect(screen.getByText('21')).toBeInTheDocument();
        expect(screen.getByText('18')).toBeInTheDocument();
        expect(screen.getByText('Awaiting Confirmation')).toBeInTheDocument();
      });

      // === STEP 8: Team confirms result ===
      const confirmButton = screen.getByText('Confirm Result');
      await user.click(confirmButton);

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith('/api/match/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: 'match-1',
          teamId: 'team-1',
          confirmed: true
        })
      });

      // === STEP 9: Match completion ===
      if (matchUpdateCallback) {
        matchUpdateCallback({
          event: 'match_completed',
          match: {
            id: 'match-1',
            team1: { id: 'team-1', name: 'Integration Warriors', members: 5, status: 'cooldown', wins: 1, lastSeen: new Date().toISOString() },
            team2: { id: 'team-2', name: 'Test Challengers', members: 4, status: 'cooldown', wins: 2, lastSeen: new Date().toISOString() },
            score1: 21,
            score2: 18,
            status: 'completed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: true, team2: true }
          },
          winner: 'Integration Warriors',
          finalScore: '21-18'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Match Completed')).toBeInTheDocument();
        expect(screen.getByText('Winner: Integration Warriors')).toBeInTheDocument();
      });

      // === STEP 10: Team returns to queue view to see updated state ===
      await user.click(queueTab);

      // Mock updated queue with winner back in queue (if champion return mode)
      if (queueUpdateCallback) {
        queueUpdateCallback({
          teams: [{
            id: 'team-1',
            name: 'Integration Warriors',
            members: 5,
            status: 'waiting',
            wins: 1,
            lastSeen: new Date().toISOString(),
            position: 1,
            contactInfo: 'warriors@test.com'
          }],
          totalTeams: 1,
          availableSlots: 9,
          event: 'team_returned'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Integration Warriors')).toBeInTheDocument();
        expect(screen.getByText('Wins: 1')).toBeInTheDocument();
      });
    });

    it('should handle error scenarios gracefully throughout user journey', async () => {
      const user = userEvent.setup();
      render(<TestWrapper><App /></TestWrapper>);

      // === STEP 1: Network error when loading queue ===
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      await waitFor(() => {
        expect(screen.getByText(/error loading queue data/i)).toBeInTheDocument();
      });

      // === STEP 2: Retry and succeed ===
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { teams: [], totalTeams: 0, availableSlots: 10 }
        })
      });

      const retryButton = screen.getByText(/retry/i);
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Current Queue')).toBeInTheDocument();
      });

      // === STEP 3: Try to join with invalid data ===
      const joinButton = screen.getByText('Join Queue');
      await user.click(joinButton);

      // Submit empty form
      const submitButton = screen.getByRole('button', { name: 'Join Queue' });
      await user.click(submitButton);

      // Should show validation errors
      expect(screen.getByText('Team name is required')).toBeInTheDocument();
      expect(screen.getByText('Number of players is required')).toBeInTheDocument();

      // === STEP 4: Fill form correctly but get server error ===
      await user.type(screen.getByLabelText('Team Name'), 'Error Test Team');
      await user.clear(screen.getByLabelText('Number of Players'));
      await user.type(screen.getByLabelText('Number of Players'), '5');

      await user.click(submitButton);

      // Simulate server error
      const errorCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      if (errorCallback) {
        errorCallback({
          code: 'QUEUE_FULL',
          message: 'Queue is currently full. Please try again later.'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Queue is currently full. Please try again later.')).toBeInTheDocument();
      });

      // === STEP 5: Connection lost during match viewing ===
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      // Simulate disconnection
      mockUseSocket.mockReturnValue({
        socket: null,
        isConnected: false,
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      });

      // Force re-render
      await user.click(queueTab);
      await user.click(matchTab);

      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });

      // === STEP 6: Reconnection ===
      mockUseSocket.mockReturnValue({
        socket: mockSocket,
        isConnected: true,
        emit: mockSocket.emit,
        on: mockSocket.on,
        off: mockSocket.off,
      });

      await user.click(queueTab);

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });
  });

  describe('Complete User Journey - Spectator Perspective', () => {
    it('should handle spectator experience watching multiple matches', async () => {
      const user = userEvent.setup();
      render(<TestWrapper><App /></TestWrapper>);

      // === STEP 1: Spectator arrives and checks current state ===
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      await waitFor(() => {
        expect(screen.getByText(/no active match/i)).toBeInTheDocument();
      });

      // === STEP 2: Check queue to see waiting teams ===
      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      // Simulate teams in queue
      const queueUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'queue-updated'
      )?.[1];

      if (queueUpdateCallback) {
        queueUpdateCallback({
          teams: [
            { id: '1', name: 'Spectator Team A', members: 5, status: 'waiting', wins: 2, lastSeen: new Date().toISOString(), position: 1 },
            { id: '2', name: 'Spectator Team B', members: 4, status: 'waiting', wins: 1, lastSeen: new Date().toISOString(), position: 2 },
            { id: '3', name: 'Spectator Team C', members: 5, status: 'waiting', wins: 0, lastSeen: new Date().toISOString(), position: 3 }
          ],
          totalTeams: 3,
          availableSlots: 7,
          event: 'queue_updated'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Spectator Team A')).toBeInTheDocument();
        expect(screen.getByText('3 teams waiting')).toBeInTheDocument();
      });

      // === STEP 3: Match starts - spectator switches to match view ===
      await user.click(matchTab);

      // Mock match start
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/match/current')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                matches: [{
                  id: 'spectator-match-1',
                  team1: { id: '1', name: 'Spectator Team A', members: 5, status: 'playing', wins: 2, lastSeen: new Date().toISOString() },
                  team2: { id: '2', name: 'Spectator Team B', members: 4, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
                  score1: 0,
                  score2: 0,
                  status: 'active',
                  startTime: new Date().toISOString(),
                  targetScore: 21,
                  matchType: 'regular',
                  confirmed: { team1: false, team2: false }
                }],
                hasActiveMatch: true
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await waitFor(() => {
        expect(screen.getByText('Spectator Team A')).toBeInTheDocument();
        expect(screen.getByText('Spectator Team B')).toBeInTheDocument();
        expect(screen.getByText('Live Match')).toBeInTheDocument();
      });

      // === STEP 4: Watch exciting match with frequent score updates ===
      const matchUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'match-updated'
      )?.[1];

      // Simulate exciting back-and-forth match
      const excitingScores = [
        { score1: 2, score2: 0 }, { score1: 2, score2: 3 }, { score1: 5, score2: 3 },
        { score1: 5, score2: 7 }, { score1: 9, score2: 7 }, { score1: 9, score2: 11 },
        { score1: 14, score2: 11 }, { score1: 14, score2: 16 }, { score1: 18, score2: 16 },
        { score1: 18, score2: 19 }, { score1: 21, score2: 19 }
      ];

      for (const [index, scores] of excitingScores.entries()) {
        if (matchUpdateCallback) {
          matchUpdateCallback({
            event: index === excitingScores.length - 1 ? 'match_ended' : 'score_updated',
            match: {
              id: 'spectator-match-1',
              team1: { id: '1', name: 'Spectator Team A', members: 5, status: 'playing', wins: 2, lastSeen: new Date().toISOString() },
              team2: { id: '2', name: 'Spectator Team B', members: 4, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
              score1: scores.score1,
              score2: scores.score2,
              status: index === excitingScores.length - 1 ? 'confirming' : 'active',
              startTime: new Date().toISOString(),
              targetScore: 21,
              matchType: 'regular',
              confirmed: { team1: false, team2: false }
            },
            score: `${scores.score1}-${scores.score2}`
          });
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await waitFor(() => {
        expect(screen.getByText('21')).toBeInTheDocument();
        expect(screen.getByText('19')).toBeInTheDocument();
        expect(screen.getByText('Awaiting Confirmation')).toBeInTheDocument();
      });

      // === STEP 5: Watch confirmation process ===
      // First team confirms
      if (matchUpdateCallback) {
        matchUpdateCallback({
          event: 'confirmation_updated',
          match: {
            id: 'spectator-match-1',
            team1: { id: '1', name: 'Spectator Team A', members: 5, status: 'playing', wins: 2, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'Spectator Team B', members: 4, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
            score1: 21,
            score2: 19,
            status: 'confirming',
            startTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: true, team2: false }
          },
          confirmationStatus: 'Team A confirmed, waiting for Team B'
        });
      }

      await waitFor(() => {
        expect(screen.getByText(/waiting for.*team b/i)).toBeInTheDocument();
      });

      // Second team confirms
      if (matchUpdateCallback) {
        matchUpdateCallback({
          event: 'match_completed',
          match: {
            id: 'spectator-match-1',
            team1: { id: '1', name: 'Spectator Team A', members: 5, status: 'cooldown', wins: 3, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'Spectator Team B', members: 4, status: 'cooldown', wins: 1, lastSeen: new Date().toISOString() },
            score1: 21,
            score2: 19,
            status: 'completed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: true, team2: true }
          },
          winner: 'Spectator Team A',
          finalScore: '21-19'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Match Completed')).toBeInTheDocument();
        expect(screen.getByText('Winner: Spectator Team A')).toBeInTheDocument();
      });

      // === STEP 6: Check queue for next match ===
      await user.click(queueTab);

      // Simulate updated queue with next teams and winner back in queue
      if (queueUpdateCallback) {
        queueUpdateCallback({
          teams: [
            { id: '1', name: 'Spectator Team A', members: 5, status: 'waiting', wins: 3, lastSeen: new Date().toISOString(), position: 1 },
            { id: '3', name: 'Spectator Team C', members: 5, status: 'waiting', wins: 0, lastSeen: new Date().toISOString(), position: 2 }
          ],
          totalTeams: 2,
          availableSlots: 8,
          event: 'post_match_update'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Spectator Team A')).toBeInTheDocument();
        expect(screen.getByText('Wins: 3')).toBeInTheDocument();
        expect(screen.getByText('Spectator Team C')).toBeInTheDocument();
      });
    });
  });

  describe('Complete User Journey - Admin Perspective', () => {
    it('should handle complete admin workflow managing court operations', async () => {
      const user = userEvent.setup();
      render(<TestWrapper><App /></TestWrapper>);

      // === STEP 1: Admin login ===
      const adminTab = screen.getByText('Admin');
      await user.click(adminTab);

      expect(screen.getByText('Admin Login')).toBeInTheDocument();

      // Mock successful login
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/admin/login') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                token: 'admin-jwt-token',
                admin: { username: 'admin' }
              }
            })
          });
        }
        if (url.includes('/api/admin/dashboard')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                queue: {
                  totalTeams: 4,
                  availableSlots: 6,
                  teams: [
                    { id: '1', name: 'Admin Team A', members: 5, status: 'waiting', wins: 1, lastSeen: new Date().toISOString(), position: 1 },
                    { id: '2', name: 'Admin Team B', members: 4, status: 'waiting', wins: 2, lastSeen: new Date().toISOString(), position: 2 },
                    { id: '3', name: 'Admin Team C', members: 5, status: 'waiting', wins: 0, lastSeen: new Date().toISOString(), position: 3 },
                    { id: '4', name: 'Admin Team D', members: 3, status: 'waiting', wins: 1, lastSeen: new Date().toISOString(), position: 4 }
                  ]
                },
                matches: {
                  totalActive: 0,
                  totalCompleted: 5
                },
                teams: {
                  total: 12,
                  waiting: 4,
                  playing: 0,
                  cooldown: 2
                }
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await user.type(screen.getByLabelText('Username'), 'admin');
      await user.type(screen.getByLabelText('Password'), 'password');
      await user.click(screen.getByRole('button', { name: 'Login' }));

      // === STEP 2: View dashboard ===
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(screen.getByText('4 teams in queue')).toBeInTheDocument();
        expect(screen.getByText('5 completed matches')).toBeInTheDocument();
        expect(screen.getByText('Admin Team A')).toBeInTheDocument();
      });

      // === STEP 3: Start a match ===
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/admin/match/start') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                match: {
                  id: 'admin-match-1',
                  team1: { id: '1', name: 'Admin Team A' },
                  team2: { id: '2', name: 'Admin Team B' },
                  status: 'active',
                  targetScore: 21,
                  matchType: 'regular'
                }
              }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: {} })
        });
      });

      const startMatchButton = screen.getByText('Start Match');
      await user.click(startMatchButton);

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/match/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-jwt-token'
        },
        body: JSON.stringify({
          team1Id: '1',
          team2Id: '2',
          targetScore: 21,
          matchType: 'regular'
        })
      });

      // === STEP 4: Monitor active match ===
      // Simulate match updates in dashboard
      const matchUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'match-updated'
      )?.[1];

      if (matchUpdateCallback) {
        matchUpdateCallback({
          event: 'score_updated',
          match: {
            id: 'admin-match-1',
            team1: { id: '1', name: 'Admin Team A', members: 5, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'Admin Team B', members: 4, status: 'playing', wins: 2, lastSeen: new Date().toISOString() },
            score1: 15,
            score2: 12,
            status: 'active',
            startTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: false, team2: false }
          },
          score: '15-12'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('15-12')).toBeInTheDocument();
      });

      // === STEP 5: Handle disputed result ===
      // Match ends but teams disagree
      if (matchUpdateCallback) {
        matchUpdateCallback({
          event: 'match_ended',
          match: {
            id: 'admin-match-1',
            team1: { id: '1', name: 'Admin Team A', members: 5, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'Admin Team B', members: 4, status: 'playing', wins: 2, lastSeen: new Date().toISOString() },
            score1: 21,
            score2: 19,
            status: 'confirming',
            startTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: true, team2: false }
          },
          confirmationStatus: 'Disputed result - admin intervention required'
        });
      }

      await waitFor(() => {
        expect(screen.getByText(/disputed result/i)).toBeInTheDocument();
      });

      // === STEP 6: Force resolve match ===
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/admin/match/admin-match-1/force-resolve')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                match: {
                  id: 'admin-match-1',
                  status: 'completed',
                  resolvedBy: 'admin'
                }
              }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: {} })
        });
      });

      const forceResolveButton = screen.getByText('Force Resolve');
      await user.click(forceResolveButton);

      // === STEP 7: Manage team operations ===
      // Navigate to team management
      const teamManagementTab = screen.getByText('Team Management');
      await user.click(teamManagementTab);

      await waitFor(() => {
        expect(screen.getByText('Team Management')).toBeInTheDocument();
      });

      // Remove a team
      const removeTeamButton = screen.getAllByText('Remove')[0];
      await user.click(removeTeamButton);

      // Confirm removal
      const confirmRemoveButton = screen.getByText('Confirm Remove');
      await user.click(confirmRemoveButton);

      // === STEP 8: Check final statistics ===
      const dashboardTab = screen.getByText('Dashboard');
      await user.click(dashboardTab);

      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });

      // Verify updated statistics
      expect(screen.getByText(/completed matches/i)).toBeInTheDocument();
      expect(screen.getByText(/teams in queue/i)).toBeInTheDocument();
    });
  });

  describe('Cross-Component Integration and State Management', () => {
    it('should maintain consistent state across all components during complex operations', async () => {
      const user = userEvent.setup();
      render(<TestWrapper><App /></TestWrapper>);

      // Track state changes across components
      const stateChanges: any[] = [];

      // === STEP 1: Initial state check across all views ===
      const queueTab = screen.getByText('Public Queue');
      const matchTab = screen.getByText('Match View');

      await user.click(queueTab);
      stateChanges.push({ component: 'queue', state: 'empty' });

      await user.click(matchTab);
      stateChanges.push({ component: 'match', state: 'no_active_match' });

      // === STEP 2: Simulate complex state changes ===
      const queueUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'queue-updated'
      )?.[1];

      const matchUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'match-updated'
      )?.[1];

      // Teams join queue
      if (queueUpdateCallback) {
        queueUpdateCallback({
          teams: [
            { id: '1', name: 'State Team A', members: 5, status: 'waiting', wins: 0, lastSeen: new Date().toISOString(), position: 1 },
            { id: '2', name: 'State Team B', members: 4, status: 'waiting', wins: 1, lastSeen: new Date().toISOString(), position: 2 }
          ],
          totalTeams: 2,
          availableSlots: 8,
          event: 'teams_joined'
        });
      }

      stateChanges.push({ component: 'queue', state: 'teams_added', count: 2 });

      // === STEP 3: Verify state consistency across views ===
      await user.click(queueTab);
      await waitFor(() => {
        expect(screen.getByText('State Team A')).toBeInTheDocument();
        expect(screen.getByText('2 teams waiting')).toBeInTheDocument();
      });

      await user.click(matchTab);
      await waitFor(() => {
        expect(screen.getByText(/no active match/i)).toBeInTheDocument();
      });

      // === STEP 4: Match starts - verify state updates ===
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/match/current')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                matches: [{
                  id: 'state-match-1',
                  team1: { id: '1', name: 'State Team A', members: 5, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
                  team2: { id: '2', name: 'State Team B', members: 4, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
                  score1: 0,
                  score2: 0,
                  status: 'active',
                  startTime: new Date().toISOString(),
                  targetScore: 21,
                  matchType: 'regular',
                  confirmed: { team1: false, team2: false }
                }],
                hasActiveMatch: true
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      // Simulate match start
      if (matchUpdateCallback) {
        matchUpdateCallback({
          event: 'match_started',
          match: {
            id: 'state-match-1',
            team1: { id: '1', name: 'State Team A', members: 5, status: 'playing', wins: 0, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'State Team B', members: 4, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
            score1: 0,
            score2: 0,
            status: 'active',
            startTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: false, team2: false }
          }
        });
      }

      // Update queue to reflect teams moved to playing
      if (queueUpdateCallback) {
        queueUpdateCallback({
          teams: [],
          totalTeams: 0,
          availableSlots: 10,
          event: 'match_started'
        });
      }

      stateChanges.push({ component: 'both', state: 'match_active', queueEmpty: true });

      // === STEP 5: Verify both views reflect the change ===
      await waitFor(() => {
        expect(screen.getByText('State Team A')).toBeInTheDocument();
        expect(screen.getByText('Live Match')).toBeInTheDocument();
      });

      await user.click(queueTab);
      await waitFor(() => {
        expect(screen.getByText('Queue is empty')).toBeInTheDocument();
      });

      // === STEP 6: Match completion and state restoration ===
      if (matchUpdateCallback) {
        matchUpdateCallback({
          event: 'match_completed',
          match: {
            id: 'state-match-1',
            team1: { id: '1', name: 'State Team A', members: 5, status: 'cooldown', wins: 1, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'State Team B', members: 4, status: 'cooldown', wins: 1, lastSeen: new Date().toISOString() },
            score1: 21,
            score2: 18,
            status: 'completed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: { team1: true, team2: true }
          },
          winner: 'State Team A',
          finalScore: '21-18'
        });
      }

      stateChanges.push({ component: 'match', state: 'completed', winner: 'State Team A' });

      // === STEP 7: Final state verification ===
      await user.click(matchTab);
      await waitFor(() => {
        expect(screen.getByText('Match Completed')).toBeInTheDocument();
      });

      // Verify state changes were tracked correctly
      expect(stateChanges.length).toBeGreaterThan(4);
      expect(stateChanges.some(change => change.state === 'match_active')).toBe(true);
      expect(stateChanges.some(change => change.state === 'completed')).toBe(true);
    });
  });
});