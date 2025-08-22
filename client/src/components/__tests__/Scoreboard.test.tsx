import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Scoreboard from '../Scoreboard';
import { Match } from '../../types';

// Mock the RealtimeDataContext
const mockUseRealtimeMatch = vi.fn();
vi.mock('../../hooks/useRealtimeMatch', () => ({
  useRealtimeMatch: () => mockUseRealtimeMatch(),
}));

describe('Scoreboard', () => {
  const mockMatch: Match = {
    id: '1',
    team1: {
      id: '1',
      name: 'Team Alpha',
      members: 5,
      contactInfo: 'alpha@test.com',
      status: 'playing',
      wins: 3,
      lastSeen: new Date(),
    },
    team2: {
      id: '2',
      name: 'Team Beta',
      members: 4,
      contactInfo: 'beta@test.com',
      status: 'playing',
      wins: 1,
      lastSeen: new Date(),
    },
    score1: 12,
    score2: 8,
    status: 'active',
    startTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    targetScore: 15,
    matchType: 'regular',
    confirmed: { team1: false, team2: false },
  };

  beforeEach(() => {
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: mockMatch,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render scoreboard with match data', () => {
    render(<Scoreboard />);

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should display match status', () => {
    render(<Scoreboard />);

    expect(screen.getByText('Live Match')).toBeInTheDocument();
    expect(screen.getByTestId('match-status')).toHaveTextContent('Active');
  });

  it('should show target score', () => {
    render(<Scoreboard />);

    expect(screen.getByText('First to 15')).toBeInTheDocument();
  });

  it('should display match duration', () => {
    render(<Scoreboard />);

    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('should highlight leading team', () => {
    render(<Scoreboard />);

    const team1Score = screen.getByTestId('team1-score');
    const team2Score = screen.getByTestId('team2-score');

    expect(team1Score).toHaveClass('leading');
    expect(team2Score).not.toHaveClass('leading');
  });

  it('should handle tied scores', () => {
    const tiedMatch = { ...mockMatch, score1: 10, score2: 10 };
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: tiedMatch,
      isLoading: false,
      error: null,
    });

    render(<Scoreboard />);

    const team1Score = screen.getByTestId('team1-score');
    const team2Score = screen.getByTestId('team2-score');

    expect(team1Score).toHaveClass('tied');
    expect(team2Score).toHaveClass('tied');
  });

  it('should show confirming status', () => {
    const confirmingMatch = { ...mockMatch, status: 'confirming' as const };
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: confirmingMatch,
      isLoading: false,
      error: null,
    });

    render(<Scoreboard />);

    expect(screen.getByText('Awaiting Confirmation')).toBeInTheDocument();
    expect(screen.getByTestId('match-status')).toHaveTextContent('Confirming');
  });

  it('should show completed status', () => {
    const completedMatch = { 
      ...mockMatch, 
      status: 'completed' as const,
      endTime: new Date(),
      score1: 15,
      score2: 12
    };
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: completedMatch,
      isLoading: false,
      error: null,
    });

    render(<Scoreboard />);

    expect(screen.getByText('Match Complete')).toBeInTheDocument();
    expect(screen.getByText('Team Alpha Wins!')).toBeInTheDocument();
    expect(screen.getByTestId('match-status')).toHaveTextContent('Completed');
  });

  it('should display champion return mode', () => {
    const championMatch = { ...mockMatch, matchType: 'champion-return' as const };
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: championMatch,
      isLoading: false,
      error: null,
    });

    render(<Scoreboard />);

    expect(screen.getByText('Champion Return')).toBeInTheDocument();
    expect(screen.getByTestId('match-type')).toHaveTextContent('Champion Return');
  });

  it('should show loading state', () => {
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: null,
      isLoading: true,
      error: null,
    });

    render(<Scoreboard />);

    expect(screen.getByText('Loading match...')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should show error state', () => {
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: null,
      isLoading: false,
      error: 'Failed to load match data',
    });

    render(<Scoreboard />);

    expect(screen.getByText('Error loading match')).toBeInTheDocument();
    expect(screen.getByText('Failed to load match data')).toBeInTheDocument();
  });

  it('should show no active match message', () => {
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: null,
      isLoading: false,
      error: null,
    });

    render(<Scoreboard />);

    expect(screen.getByText('No Active Match')).toBeInTheDocument();
    expect(screen.getByText('Waiting for next game to start...')).toBeInTheDocument();
  });

  it('should update scores in real-time', () => {
    const { rerender } = render(<Scoreboard />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();

    // Update scores
    const updatedMatch = { ...mockMatch, score1: 13, score2: 9 };
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: updatedMatch,
      isLoading: false,
      error: null,
    });

    rerender(<Scoreboard />);

    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('should show progress to target score', () => {
    render(<Scoreboard />);

    const team1Progress = screen.getByTestId('team1-progress');
    const team2Progress = screen.getByTestId('team2-progress');

    expect(team1Progress).toHaveStyle('width: 80%'); // 12/15 = 80%
    expect(team2Progress).toHaveStyle('width: 53.33%'); // 8/15 = 53.33%
  });

  it('should handle match near completion', () => {
    const nearCompleteMatch = { ...mockMatch, score1: 14, score2: 13 };
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: nearCompleteMatch,
      isLoading: false,
      error: null,
    });

    render(<Scoreboard />);

    expect(screen.getByTestId('scoreboard')).toHaveClass('match-point');
    expect(screen.getByText('Match Point!')).toBeInTheDocument();
  });

  it('should be responsive on mobile', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(<Scoreboard />);

    const scoreboard = screen.getByTestId('scoreboard');
    expect(scoreboard).toHaveClass('mobile-layout');
  });

  it('should display team win counts', () => {
    render(<Scoreboard />);

    expect(screen.getByText('3 wins')).toBeInTheDocument();
    expect(screen.getByText('1 win')).toBeInTheDocument();
  });

  it('should show confirmation status for each team', () => {
    const confirmingMatch = { 
      ...mockMatch, 
      status: 'confirming' as const,
      confirmed: { team1: true, team2: false }
    };
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: confirmingMatch,
      isLoading: false,
      error: null,
    });

    render(<Scoreboard />);

    expect(screen.getByTestId('team1-confirmation')).toHaveTextContent('✓ Confirmed');
    expect(screen.getByTestId('team2-confirmation')).toHaveTextContent('⏳ Waiting');
  });

  it('should animate score changes', () => {
    const { rerender } = render(<Scoreboard />);

    const team1Score = screen.getByTestId('team1-score');
    expect(team1Score).not.toHaveClass('score-changed');

    // Update score
    const updatedMatch = { ...mockMatch, score1: 13 };
    mockUseRealtimeMatch.mockReturnValue({
      currentMatch: updatedMatch,
      isLoading: false,
      error: null,
    });

    rerender(<Scoreboard />);

    expect(team1Score).toHaveClass('score-changed');
  });
});