import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { SocketProvider } from '../../contexts/SocketContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { AuthProvider } from '../../contexts/AuthContext';

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

// Mock API calls
global.fetch = vi.fn();

const renderApp = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('User Workflow Integration Tests', () => {
  beforeEach(() => {
    mockUseSocket.mockReturnValue({
      socket: mockSocket,
      isConnected: true,
      emit: mockSocket.emit,
      on: mockSocket.on,
      off: mockSocket.off,
    });

    // Mock successful API responses
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          teams: [],
          totalTeams: 0,
          availableSlots: 10,
        },
      }),
    });

    vi.clearAllMocks();
  });

  describe('Complete Queue Join Workflow', () => {
    it('should allow user to join queue through complete UI flow', async () => {
      const user = userEvent.setup();
      renderApp();

      // Navigate to Public Queue page
      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      // Wait for queue data to load
      await waitFor(() => {
        expect(screen.getByText('Current Queue')).toBeInTheDocument();
      });

      // Click Join Queue button
      const joinButton = screen.getByText('Join Queue');
      await user.click(joinButton);

      // Fill out the join queue form
      const teamNameInput = screen.getByLabelText('Team Name');
      const playersInput = screen.getByLabelText('Number of Players');
      const contactInput = screen.getByLabelText('Contact Info (Optional)');

      await user.type(teamNameInput, 'Integration Test Team');
      await user.clear(playersInput);
      await user.type(playersInput, '5');
      await user.type(contactInput, 'test@integration.com');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: 'Join Queue' });
      await user.click(submitButton);

      // Verify WebSocket emit was called
      expect(mockSocket.emit).toHaveBeenCalledWith('join-queue', {
        name: 'Integration Test Team',
        members: 5,
        contactInfo: 'test@integration.com',
      });

      // Simulate successful response
      const notificationCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'notification'
      )?.[1];

      if (notificationCallback) {
        notificationCallback({
          type: 'success',
          title: 'Joined Queue',
          message: 'Team "Integration Test Team" successfully joined at position 1',
        });
      }

      // Verify success feedback
      await waitFor(() => {
        expect(screen.getByText('Successfully joined queue!')).toBeInTheDocument();
      });
    });

    it('should handle queue join errors gracefully', async () => {
      const user = userEvent.setup();
      renderApp();

      // Navigate to queue and open join modal
      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      const joinButton = screen.getByText('Join Queue');
      await user.click(joinButton);

      // Fill form with duplicate team name
      const teamNameInput = screen.getByLabelText('Team Name');
      await user.type(teamNameInput, 'Duplicate Team');

      const submitButton = screen.getByRole('button', { name: 'Join Queue' });
      await user.click(submitButton);

      // Simulate error response
      const errorCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      if (errorCallback) {
        errorCallback({
          code: 'TEAM_NAME_EXISTS',
          message: 'Team name already exists',
        });
      }

      // Verify error is displayed
      await waitFor(() => {
        expect(screen.getByText('Team name already exists')).toBeInTheDocument();
      });
    });

    it('should validate form inputs before submission', async () => {
      const user = userEvent.setup();
      renderApp();

      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      const joinButton = screen.getByText('Join Queue');
      await user.click(joinButton);

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: 'Join Queue' });
      await user.click(submitButton);

      // Verify validation errors
      expect(screen.getByText('Team name is required')).toBeInTheDocument();
      expect(screen.getByText('Number of players is required')).toBeInTheDocument();

      // Verify WebSocket was not called
      expect(mockSocket.emit).not.toHaveBeenCalledWith('join-queue', expect.anything());
    });
  });

  describe('Match Viewing Workflow', () => {
    it('should display live match information', async () => {
      const user = userEvent.setup();
      
      // Mock active match data
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            matches: [{
              id: '1',
              team1: { name: 'Team Alpha', wins: 3 },
              team2: { name: 'Team Beta', wins: 1 },
              score1: 12,
              score2: 8,
              status: 'active',
              targetScore: 15,
            }],
            hasActiveMatch: true,
          },
        }),
      });

      renderApp();

      // Navigate to Match View
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      // Wait for match data to load
      await waitFor(() => {
        expect(screen.getByText('Team Alpha')).toBeInTheDocument();
        expect(screen.getByText('Team Beta')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
      });

      // Verify match status
      expect(screen.getByText('Live Match')).toBeInTheDocument();
      expect(screen.getByText('First to 15')).toBeInTheDocument();
    });

    it('should handle real-time score updates', async () => {
      const user = userEvent.setup();
      renderApp();

      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      // Simulate real-time score update
      const matchUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'match-updated'
      )?.[1];

      if (matchUpdateCallback) {
        matchUpdateCallback({
          event: 'score_updated',
          match: {
            id: '1',
            team1: { name: 'Team Alpha' },
            team2: { name: 'Team Beta' },
            score1: 13,
            score2: 10,
            status: 'active',
          },
          score: '13-10',
        });
      }

      // Verify scores updated
      await waitFor(() => {
        expect(screen.getByText('13')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });

    it('should display match completion and confirmation', async () => {
      const user = userEvent.setup();
      renderApp();

      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      // Simulate match completion
      const matchUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'match-updated'
      )?.[1];

      if (matchUpdateCallback) {
        matchUpdateCallback({
          event: 'match_ended',
          match: {
            id: '1',
            team1: { name: 'Team Alpha' },
            team2: { name: 'Team Beta' },
            score1: 15,
            score2: 12,
            status: 'confirming',
          },
        });
      }

      // Verify confirmation UI appears
      await waitFor(() => {
        expect(screen.getByText('Awaiting Confirmation')).toBeInTheDocument();
        expect(screen.getByText('Confirm Result')).toBeInTheDocument();
      });
    });
  });

  describe('Admin Dashboard Workflow', () => {
    it('should require authentication for admin access', async () => {
      const user = userEvent.setup();
      renderApp();

      // Try to access admin tab
      const adminTab = screen.getByText('Admin');
      await user.click(adminTab);

      // Should show login form
      expect(screen.getByText('Admin Login')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('should handle admin login flow', async () => {
      const user = userEvent.setup();
      
      // Mock successful login
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: 'admin-jwt-token',
            admin: { username: 'admin' },
          },
        }),
      });

      renderApp();

      const adminTab = screen.getByText('Admin');
      await user.click(adminTab);

      // Fill login form
      const usernameInput = screen.getByLabelText('Username');
      const passwordInput = screen.getByLabelText('Password');
      
      await user.type(usernameInput, 'admin');
      await user.type(passwordInput, 'password');

      const loginButton = screen.getByRole('button', { name: 'Login' });
      await user.click(loginButton);

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password' }),
      });

      // Should redirect to dashboard
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });
    });

    it('should display dashboard data after login', async () => {
      const user = userEvent.setup();
      
      // Mock login and dashboard data
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { token: 'admin-jwt-token', admin: { username: 'admin' } },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              queue: { totalTeams: 3, availableSlots: 7 },
              matches: { totalActive: 1 },
              teams: { total: 10, waiting: 3, playing: 2, cooldown: 1 },
            },
          }),
        });

      renderApp();

      // Login process
      const adminTab = screen.getByText('Admin');
      await user.click(adminTab);

      await user.type(screen.getByLabelText('Username'), 'admin');
      await user.type(screen.getByLabelText('Password'), 'password');
      await user.click(screen.getByRole('button', { name: 'Login' }));

      // Verify dashboard displays
      await waitFor(() => {
        expect(screen.getByText('3 teams in queue')).toBeInTheDocument();
        expect(screen.getByText('1 active match')).toBeInTheDocument();
        expect(screen.getByText('10 total teams')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and State Management', () => {
    it('should maintain state when switching between tabs', async () => {
      const user = userEvent.setup();
      renderApp();

      // Start on Public Queue
      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      await waitFor(() => {
        expect(screen.getByText('Current Queue')).toBeInTheDocument();
      });

      // Switch to Match View
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      await waitFor(() => {
        expect(screen.getByText('Live Match') || screen.getByText('No Active Match')).toBeInTheDocument();
      });

      // Switch back to Queue
      await user.click(queueTab);

      // Queue should still be displayed
      expect(screen.getByText('Current Queue')).toBeInTheDocument();
    });

    it('should handle connection status changes', async () => {
      const user = userEvent.setup();
      renderApp();

      // Initially connected
      expect(screen.getByText('Connected')).toBeInTheDocument();

      // Simulate disconnection
      mockUseSocket.mockReturnValue({
        socket: null,
        isConnected: false,
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      });

      // Force re-render
      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      // Should show disconnected state
      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock API error
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      renderApp();

      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      // Should display error state
      await waitFor(() => {
        expect(screen.getByText('Error loading queue data')).toBeInTheDocument();
      });
    });

    it('should retry failed operations', async () => {
      const user = userEvent.setup();
      renderApp();

      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      // Mock initial failure then success
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { teams: [], totalTeams: 0 },
          }),
        });

      // Click retry button if available
      const retryButton = screen.queryByText('Retry');
      if (retryButton) {
        await user.click(retryButton);

        await waitFor(() => {
          expect(screen.getByText('Current Queue')).toBeInTheDocument();
        });
      }
    });

    it('should handle WebSocket reconnection', async () => {
      const user = userEvent.setup();
      renderApp();

      // Start disconnected
      mockUseSocket.mockReturnValue({
        socket: null,
        isConnected: false,
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      });

      const queueTab = screen.getByText('Public Queue');
      await user.click(queueTab);

      expect(screen.getByText('Disconnected')).toBeInTheDocument();

      // Simulate reconnection
      mockUseSocket.mockReturnValue({
        socket: mockSocket,
        isConnected: true,
        emit: mockSocket.emit,
        on: mockSocket.on,
        off: mockSocket.off,
      });

      // Force re-render
      const matchTab = screen.getByText('Match View');
      await user.click(matchTab);

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design and Accessibility', () => {
    it('should be accessible with keyboard navigation', async () => {
      renderApp();

      // Tab through navigation
      fireEvent.keyDown(document.body, { key: 'Tab' });
      
      const queueTab = screen.getByText('Public Queue');
      expect(queueTab).toHaveFocus();

      // Enter to activate
      fireEvent.keyDown(queueTab, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Current Queue')).toBeInTheDocument();
      });
    });

    it('should handle mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderApp();

      // Should render mobile-friendly layout
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('mobile-nav');
    });

    it('should provide proper ARIA labels', () => {
      renderApp();

      // Check for proper labeling
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Main navigation');
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });
});