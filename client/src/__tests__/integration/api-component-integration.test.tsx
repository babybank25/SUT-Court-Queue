import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { PublicQueue } from '../../pages/PublicQueue';
import { MatchView } from '../../pages/MatchView';
import { AdminDashboard } from '../../pages/AdminDashboard';
import { SocketProvider } from '../../contexts/SocketContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { RealtimeDataProvider } from '../../contexts/RealtimeDataContext';

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

describe('API-Component Integration Tests', () => {
  beforeEach(() => {
    mockUseSocket.mockReturnValue({
      socket: mockSocket,
      isConnected: true,
      emit: mockSocket.emit,
      on: mockSocket.on,
      off: mockSocket.off,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('PublicQueue API Integration', () => {
    it('should fetch and display queue data on component mount', async () => {
      const mockQueueData = {
        success: true,
        data: {
          teams: [
            {
              id: '1',
              name: 'Team Alpha',
              members: 5,
              status: 'waiting',
              wins: 2,
              lastSeen: new Date().toISOString(),
              position: 1,
              contactInfo: 'alpha@test.com'
            },
            {
              id: '2',
              name: 'Team Beta',
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
          maxSize: 10
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQueueData
      });

      render(
        <TestWrapper>
          <PublicQueue />
        </TestWrapper>
      );

      // Verify API call was made
      expect(global.fetch).toHaveBeenCalledWith('/api/queue');

      // Wait for data to load and display
      await waitFor(() => {
        expect(screen.getByText('Team Alpha')).toBeInTheDocument();
        expect(screen.getByText('Team Beta')).toBeInTheDocument();
        expect(screen.getByText('Position: 1')).toBeInTheDocument();
        expect(screen.getByText('Position: 2')).toBeInTheDocument();
        expect(screen.getByText('2 teams waiting')).toBeInTheDocument();
        expect(screen.getByText('8 slots available')).toBeInTheDocument();
      });
    });

    it('should handle API errors and display error state', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <PublicQueue />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/error loading queue data/i)).toBeInTheDocument();
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });

    it('should retry API calls when retry button is clicked', async () => {
      const user = userEvent.setup();

      // First call fails
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { teams: [], totalTeams: 0, availableSlots: 10 }
          })
        });

      render(
        <TestWrapper>
          <PublicQueue />
        </TestWrapper>
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/error loading queue data/i)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText(/retry/i);
      await user.click(retryButton);

      // Verify second API call
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Should show success state
      await waitFor(() => {
        expect(screen.getByText(/queue is empty/i)).toBeInTheDocument();
      });
    });

    it('should integrate WebSocket updates with API data', async () => {
      // Initial API data
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { teams: [], totalTeams: 0, availableSlots: 10 }
        })
      });

      render(
        <TestWrapper>
          <PublicQueue />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/queue is empty/i)).toBeInTheDocument();
      });

      // Simulate WebSocket update
      const queueUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'queue-updated'
      )?.[1];

      if (queueUpdateCallback) {
        queueUpdateCallback({
          teams: [{
            id: '1',
            name: 'WebSocket Team',
            members: 5,
            status: 'waiting',
            wins: 0,
            lastSeen: new Date().toISOString(),
            position: 1
          }],
          totalTeams: 1,
          availableSlots: 9,
          event: 'team_joined'
        });
      }

      // Should update display without additional API call
      await waitFor(() => {
        expect(screen.getByText('WebSocket Team')).toBeInTheDocument();
        expect(screen.getByText('1 team waiting')).toBeInTheDocument();
      });

      // Should not have made additional API calls
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle join queue form submission with API integration', async () => {
      const user = userEvent.setup();

      // Mock initial queue data
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { teams: [], totalTeams: 0, availableSlots: 10 }
        })
      });

      render(
        <TestWrapper>
          <PublicQueue />
        </TestWrapper>
      );

      // Open join queue modal
      const joinButton = screen.getByText('Join Queue');
      await user.click(joinButton);

      // Fill form
      await user.type(screen.getByLabelText('Team Name'), 'API Test Team');
      await user.clear(screen.getByLabelText('Number of Players'));
      await user.type(screen.getByLabelText('Number of Players'), '5');
      await user.type(screen.getByLabelText('Contact Info (Optional)'), 'api@test.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: 'Join Queue' });
      await user.click(submitButton);

      // Verify WebSocket emit was called (form uses WebSocket, not direct API)
      expect(mockSocket.emit).toHaveBeenCalledWith('join-queue', {
        name: 'API Test Team',
        members: 5,
        contactInfo: 'api@test.com'
      });
    });

    it('should handle court status API integration', async () => {
      // Mock queue API
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/queue')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { teams: [], totalTeams: 0, availableSlots: 10 }
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
                currentTime: '2024-01-15T10:30:00.000Z',
                timezone: 'Asia/Bangkok',
                mode: 'champion-return',
                cooldownEnd: '2024-01-15T10:35:00.000Z'
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <TestWrapper>
          <PublicQueue />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/court open/i)).toBeInTheDocument();
        expect(screen.getByText(/champion return mode/i)).toBeInTheDocument();
      });

      // Verify both API calls were made
      expect(global.fetch).toHaveBeenCalledWith('/api/queue');
      expect(global.fetch).toHaveBeenCalledWith('/api/court/status');
    });
  });

  describe('MatchView API Integration', () => {
    it('should fetch and display current match data', async () => {
      const mockMatchData = {
        success: true,
        data: {
          matches: [{
            id: 'match-1',
            team1: {
              id: '1',
              name: 'Team Alpha',
              members: 5,
              status: 'playing',
              wins: 3,
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
            score1: 12,
            score2: 8,
            status: 'active',
            startTime: new Date().toISOString(),
            targetScore: 21,
            matchType: 'regular',
            confirmed: {
              team1: false,
              team2: false
            }
          }],
          hasActiveMatch: true
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMatchData
      });

      render(
        <TestWrapper>
          <MatchView />
        </TestWrapper>
      );

      expect(global.fetch).toHaveBeenCalledWith('/api/match/current');

      await waitFor(() => {
        expect(screen.getByText('Team Alpha')).toBeInTheDocument();
        expect(screen.getByText('Team Beta')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('First to 21')).toBeInTheDocument();
      });
    });

    it('should handle match confirmation API calls', async () => {
      const user = userEvent.setup();

      // Mock match in confirming state
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/match/current')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                matches: [{
                  id: 'match-1',
                  team1: { id: '1', name: 'Team Alpha', members: 5, status: 'playing', wins: 3, lastSeen: new Date().toISOString() },
                  team2: { id: '2', name: 'Team Beta', members: 4, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
                  score1: 21,
                  score2: 18,
                  status: 'confirming',
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
        if (url.includes('/api/match/confirm') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                match: { status: 'completed' },
                confirmed: true
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <TestWrapper>
          <MatchView />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Awaiting Confirmation')).toBeInTheDocument();
      });

      // Click confirm button
      const confirmButton = screen.getByText('Confirm Result');
      await user.click(confirmButton);

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith('/api/match/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: 'match-1',
          teamId: expect.any(String),
          confirmed: true
        })
      });
    });

    it('should integrate real-time match updates with API data', async () => {
      // Initial API data
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            matches: [{
              id: 'match-1',
              team1: { id: '1', name: 'Team Alpha', members: 5, status: 'playing', wins: 3, lastSeen: new Date().toISOString() },
              team2: { id: '2', name: 'Team Beta', members: 4, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
              score1: 10,
              score2: 8,
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

      render(
        <TestWrapper>
          <MatchView />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
      });

      // Simulate WebSocket score update
      const matchUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'match-updated'
      )?.[1];

      if (matchUpdateCallback) {
        matchUpdateCallback({
          event: 'score_updated',
          match: {
            id: 'match-1',
            team1: { id: '1', name: 'Team Alpha', members: 5, status: 'playing', wins: 3, lastSeen: new Date().toISOString() },
            team2: { id: '2', name: 'Team Beta', members: 4, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
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

      // Should update display
      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
      });
    });

    it('should handle match events API integration', async () => {
      // Mock current match
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/match/current')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                matches: [{
                  id: 'match-1',
                  team1: { id: '1', name: 'Team Alpha', members: 5, status: 'playing', wins: 3, lastSeen: new Date().toISOString() },
                  team2: { id: '2', name: 'Team Beta', members: 4, status: 'playing', wins: 1, lastSeen: new Date().toISOString() },
                  score1: 15,
                  score2: 12,
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
        if (url.includes('/api/match/match-1/events')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                events: [
                  {
                    id: '1',
                    matchId: 'match-1',
                    type: 'score_update',
                    data: { score1: 5, score2: 3 },
                    timestamp: new Date().toISOString()
                  },
                  {
                    id: '2',
                    matchId: 'match-1',
                    type: 'score_update',
                    data: { score1: 10, score2: 8 },
                    timestamp: new Date().toISOString()
                  }
                ]
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <TestWrapper>
          <MatchView />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Team Alpha')).toBeInTheDocument();
        expect(screen.getByText('Recent Events')).toBeInTheDocument();
      });

      // Verify events API was called
      expect(global.fetch).toHaveBeenCalledWith('/api/match/match-1/events?limit=10');
    });
  });

  describe('AdminDashboard API Integration', () => {
    it('should require authentication and fetch dashboard data', async () => {
      const user = userEvent.setup();

      // Mock login and dashboard APIs
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
                  totalTeams: 5,
                  availableSlots: 5,
                  teams: []
                },
                matches: {
                  totalActive: 2,
                  totalCompleted: 15
                },
                teams: {
                  total: 20,
                  waiting: 5,
                  playing: 4,
                  cooldown: 2
                }
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      // Should show login form initially
      expect(screen.getByText('Admin Login')).toBeInTheDocument();

      // Login
      await user.type(screen.getByLabelText('Username'), 'admin');
      await user.type(screen.getByLabelText('Password'), 'password');
      await user.click(screen.getByRole('button', { name: 'Login' }));

      // Verify login API call
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password' })
      });

      // Should fetch and display dashboard data
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(screen.getByText('5 teams in queue')).toBeInTheDocument();
        expect(screen.getByText('2 active matches')).toBeInTheDocument();
        expect(screen.getByText('20 total teams')).toBeInTheDocument();
      });

      // Verify dashboard API call with auth header
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/dashboard', {
        headers: { 'Authorization': 'Bearer admin-jwt-token' }
      });
    });

    it('should handle admin actions with proper API calls', async () => {
      const user = userEvent.setup();

      // Mock authenticated state and APIs
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/admin/dashboard')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                queue: { totalTeams: 2, availableSlots: 8, teams: [
                  { id: '1', name: 'Team Alpha', members: 5, status: 'waiting', wins: 0, lastSeen: new Date().toISOString(), position: 1 },
                  { id: '2', name: 'Team Beta', members: 4, status: 'waiting', wins: 1, lastSeen: new Date().toISOString(), position: 2 }
                ]},
                matches: { totalActive: 0, totalCompleted: 10 },
                teams: { total: 15, waiting: 2, playing: 0, cooldown: 0 }
              }
            })
          });
        }
        if (url.includes('/api/admin/match/start') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                match: {
                  id: 'new-match-1',
                  team1: { id: '1', name: 'Team Alpha' },
                  team2: { id: '2', name: 'Team Beta' },
                  status: 'active',
                  targetScore: 21
                }
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      // Mock authenticated context
      const AuthenticatedWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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

      render(
        <AuthenticatedWrapper>
          <AdminDashboard />
        </AuthenticatedWrapper>
      );

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Team Alpha')).toBeInTheDocument();
        expect(screen.getByText('Team Beta')).toBeInTheDocument();
      });

      // Start a match
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
    });

    it('should handle API errors in admin operations', async () => {
      const user = userEvent.setup();

      // Mock API error
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/admin/dashboard')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                queue: { totalTeams: 2, availableSlots: 8, teams: [
                  { id: '1', name: 'Team Alpha', members: 5, status: 'waiting', wins: 0, lastSeen: new Date().toISOString(), position: 1 },
                  { id: '2', name: 'Team Beta', members: 4, status: 'waiting', wins: 1, lastSeen: new Date().toISOString(), position: 2 }
                ]},
                matches: { totalActive: 0, totalCompleted: 10 },
                teams: { total: 15, waiting: 2, playing: 0, cooldown: 0 }
              }
            })
          });
        }
        if (url.includes('/api/admin/match/start')) {
          return Promise.resolve({
            ok: false,
            json: async () => ({
              success: false,
              error: {
                code: 'INSUFFICIENT_TEAMS',
                message: 'Not enough teams in queue to start match'
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });

      // Try to start match
      const startMatchButton = screen.getByText('Start Match');
      await user.click(startMatchButton);

      // Should display error message
      await waitFor(() => {
        expect(screen.getByText('Not enough teams in queue to start match')).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Component Data Consistency', () => {
    it('should maintain data consistency across different views', async () => {
      const user = userEvent.setup();

      // Mock APIs for both components
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/queue')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                teams: [{ id: '1', name: 'Consistent Team', members: 5, status: 'waiting', wins: 0, lastSeen: new Date().toISOString(), position: 1 }],
                totalTeams: 1,
                availableSlots: 9
              }
            })
          });
        }
        if (url.includes('/api/match/current')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { matches: [], hasActiveMatch: false }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const { rerender } = render(
        <TestWrapper>
          <PublicQueue />
        </TestWrapper>
      );

      // Verify queue data loads
      await waitFor(() => {
        expect(screen.getByText('Consistent Team')).toBeInTheDocument();
      });

      // Switch to MatchView
      rerender(
        <TestWrapper>
          <MatchView />
        </TestWrapper>
      );

      // Should show no active match
      await waitFor(() => {
        expect(screen.getByText(/no active match/i)).toBeInTheDocument();
      });

      // Simulate WebSocket update that affects both views
      const queueUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'queue-updated'
      )?.[1];

      if (queueUpdateCallback) {
        queueUpdateCallback({
          teams: [],
          totalTeams: 0,
          availableSlots: 10,
          event: 'team_removed'
        });
      }

      // Switch back to PublicQueue
      rerender(
        <TestWrapper>
          <PublicQueue />
        </TestWrapper>
      );

      // Should reflect the WebSocket update
      await waitFor(() => {
        expect(screen.getByText(/queue is empty/i)).toBeInTheDocument();
      });
    });

    it('should handle concurrent API calls without race conditions', async () => {
      // Mock multiple API endpoints
      let queueCallCount = 0;
      let matchCallCount = 0;

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/queue')) {
          queueCallCount++;
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({
                  success: true,
                  data: {
                    teams: [{ id: `${queueCallCount}`, name: `Team ${queueCallCount}`, members: 5, status: 'waiting', wins: 0, lastSeen: new Date().toISOString(), position: 1 }],
                    totalTeams: 1,
                    availableSlots: 9
                  }
                })
              });
            }, Math.random() * 100); // Random delay to simulate race conditions
          });
        }
        if (url.includes('/api/match/current')) {
          matchCallCount++;
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({
                  success: true,
                  data: { matches: [], hasActiveMatch: false }
                })
              });
            }, Math.random() * 100);
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      // Render multiple components simultaneously
      const { rerender } = render(
        <TestWrapper>
          <PublicQueue />
        </TestWrapper>
      );

      rerender(
        <TestWrapper>
          <MatchView />
        </TestWrapper>
      );

      rerender(
        <TestWrapper>
          <PublicQueue />
        </TestWrapper>
      );

      // Wait for all API calls to complete
      await waitFor(() => {
        expect(queueCallCount).toBeGreaterThan(0);
        expect(matchCallCount).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Should display data from the latest successful call
      expect(screen.getByText(/Team \d+/)).toBeInTheDocument();
    });
  });
});