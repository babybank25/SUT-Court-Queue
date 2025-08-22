import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmationModal } from '../ConfirmationModal';
import { SocketContext } from '../../contexts/SocketContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { Match, Team } from '../../types';

// Mock the socket context
const mockSocketContext = {
  isConnected: true,
  connectionStatus: {
    isConnected: true,
    connectionError: null,
    reconnectAttempts: 0
  },
  emit: jest.fn(),
  joinQueue: jest.fn(),
  confirmResult: jest.fn().mockReturnValue(true),
  joinRoom: jest.fn(),
  leaveRoom: jest.fn()
};

// Mock match data
const mockTeam1: Team = {
  id: 'team-1',
  name: 'Team Alpha',
  members: 5,
  status: 'playing',
  wins: 3,
  lastSeen: new Date()
};

const mockTeam2: Team = {
  id: 'team-2',
  name: 'Team Beta',
  members: 4,
  status: 'playing',
  wins: 2,
  lastSeen: new Date()
};

const mockMatch: Match = {
  id: 'match-1',
  team1: mockTeam1,
  team2: mockTeam2,
  score1: 21,
  score2: 18,
  status: 'confirming',
  startTime: new Date(),
  targetScore: 21,
  matchType: 'regular',
  confirmed: {
    team1: false,
    team2: false
  }
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <SocketContext.Provider value={mockSocketContext}>
      <ToastProvider>
        {component}
      </ToastProvider>
    </SocketContext.Provider>
  );
};

describe('ConfirmationModal', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirmationSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    renderWithProviders(
      <ConfirmationModal
        isOpen={false}
        onClose={mockOnClose}
        match={mockMatch}
        currentTeam={mockTeam1}
      />
    );

    expect(screen.queryByText('Confirm Match Result')).not.toBeInTheDocument();
  });

  it('should not render when match status is not confirming', () => {
    const activeMatch = { ...mockMatch, status: 'active' as const };
    
    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={activeMatch}
        currentTeam={mockTeam1}
      />
    );

    expect(screen.queryByText('Confirm Match Result')).not.toBeInTheDocument();
  });

  it('should render confirmation modal when open and match is confirming', () => {
    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={mockMatch}
        currentTeam={mockTeam1}
      />
    );

    expect(screen.getByText('Confirm Match Result')).toBeInTheDocument();
    expect(screen.getByText('Final Score')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument(); // Team 1 score
    expect(screen.getByText('18')).toBeInTheDocument(); // Team 2 score
    expect(screen.getByText('Do you confirm this result?')).toBeInTheDocument();
  });

  it('should display team names and scores correctly', () => {
    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={mockMatch}
        currentTeam={mockTeam1}
      />
    );

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('should show confirmation status for both teams', () => {
    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={mockMatch}
        currentTeam={mockTeam1}
      />
    );

    expect(screen.getByText('Team Alpha (You)')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
    expect(screen.getAllByText('Waiting...')).toHaveLength(2);
  });

  it('should handle confirm result action', async () => {
    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={mockMatch}
        currentTeam={mockTeam1}
        onConfirmationSuccess={mockOnConfirmationSuccess}
      />
    );

    const confirmButton = screen.getByText('Confirm Result');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockSocketContext.confirmResult).toHaveBeenCalledWith(
        'match-1',
        'team-1',
        true
      );
    });
  });

  it('should handle dispute result action', async () => {
    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={mockMatch}
        currentTeam={mockTeam1}
        onConfirmationSuccess={mockOnConfirmationSuccess}
      />
    );

    const disputeButton = screen.getByText('Dispute Result');
    fireEvent.click(disputeButton);

    await waitFor(() => {
      expect(mockSocketContext.confirmResult).toHaveBeenCalledWith(
        'match-1',
        'team-1',
        false
      );
    });
  });

  it('should show success state after confirmation', async () => {
    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={mockMatch}
        currentTeam={mockTeam1}
        onConfirmationSuccess={mockOnConfirmationSuccess}
      />
    );

    const confirmButton = screen.getByText('Confirm Result');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Result Confirmed!')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });
  });

  it('should show already confirmed state when team has already confirmed', () => {
    const confirmedMatch = {
      ...mockMatch,
      confirmed: { team1: true, team2: false }
    };

    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={confirmedMatch}
        currentTeam={mockTeam1}
      />
    );

    expect(screen.getByText('You have already confirmed this result')).toBeInTheDocument();
    expect(screen.getByText('✓ Confirmed')).toBeInTheDocument();
    expect(screen.queryByText('Do you confirm this result?')).not.toBeInTheDocument();
  });

  it('should show countdown timer', () => {
    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={mockMatch}
        currentTeam={mockTeam1}
      />
    );

    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it('should handle close button click', () => {
    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={mockMatch}
        currentTeam={mockTeam1}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should disable buttons when not connected', () => {
    const disconnectedContext = {
      ...mockSocketContext,
      isConnected: false
    };

    render(
      <SocketContext.Provider value={disconnectedContext}>
        <ToastProvider>
          <ConfirmationModal
            isOpen={true}
            onClose={mockOnClose}
            match={mockMatch}
            currentTeam={mockTeam1}
          />
        </ToastProvider>
      </SocketContext.Provider>
    );

    expect(screen.getByText('Confirm Result')).toBeDisabled();
    expect(screen.getByText('Dispute Result')).toBeDisabled();
    expect(screen.getByText('Not connected to server')).toBeInTheDocument();
  });

  it('should show both confirmed message when both teams confirmed', () => {
    const bothConfirmedMatch = {
      ...mockMatch,
      confirmed: { team1: true, team2: true }
    };

    renderWithProviders(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        match={bothConfirmedMatch}
        currentTeam={mockTeam1}
      />
    );

    expect(screen.getByText('Both teams have confirmed')).toBeInTheDocument();
  });
});