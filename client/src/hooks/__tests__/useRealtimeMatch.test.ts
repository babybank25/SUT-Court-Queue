import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeMatch } from '../useRealtimeMatch';
import { useSocketContext } from '../../contexts/SocketContext';
import { MatchUpdateData, Match } from '../../types';

// Mock the socket context
jest.mock('../../contexts/SocketContext');
const mockUseSocketContext = useSocketContext as jest.MockedFunction<typeof useSocketContext>;

// Mock fetch
global.fetch = jest.fn();

describe('useRealtimeMatch', () => {
  const mockOnMatchUpdate = jest.fn();
  const mockSocketOnMatchUpdate = jest.fn();

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
    score1: 15,
    score2: 12,
    status: 'active',
    startTime: new Date(Date.now() - 600000), // 10 minutes ago
    targetScore: 21,
    matchType: 'regular',
    confirmed: {
      team1: false,
      team2: false
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSocketContext.mockReturnValue({
      onMatchUpdate: mockSocketOnMatchUpdate,
      isConnected: true,
      onQueueUpdate: jest.fn(),
      onCourtStatusUpdate: jest.fn(),
      onNotification: jest.fn(),
      emit: jest.fn(),
      socket: null
    });

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          matches: [mockMatch]
        }
      })
    });
  });

  it('initializes with no current match', () => {
    const { result } = renderHook(() => useRealtimeMatch({ autoFetch: false }));

    expect(result.current.currentMatch).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.hasActiveMatch).toBe(false);
  });

  it('fetches initial match data when connected', async () => {
    const { result } = renderHook(() => useRealtimeMatch());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentMatch).toEqual(mockMatch);
    expect(result.current.hasActiveMatch).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRealtimeMatch());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('handles WebSocket match updates', () => {
    const { result } = renderHook(() => useRealtimeMatch({ 
      onMatchUpdate: mockOnMatchUpdate,
      autoFetch: false 
    }));

    const updateData: MatchUpdateData = {
      match: mockMatch,
      event: 'score_updated',
      score: '15-12'
    };

    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback(updateData);
    });

    expect(result.current.currentMatch).toEqual(mockMatch);
    expect(result.current.lastUpdate).toEqual(updateData);
    expect(mockOnMatchUpdate).toHaveBeenCalledWith(updateData);
  });

  it('calculates match duration correctly', () => {
    const { result } = renderHook(() => useRealtimeMatch({ autoFetch: false }));

    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: mockMatch, event: 'score_updated' });
    });

    expect(result.current.getMatchDuration()).toBe(10); // 10 minutes
    expect(result.current.matchDuration).toBe(10);
  });

  it('identifies winning and losing teams', () => {
    const { result } = renderHook(() => useRealtimeMatch({ autoFetch: false }));

    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: mockMatch, event: 'score_updated' });
    });

    expect(result.current.getWinningTeam()).toEqual(mockMatch.team1); // 15 > 12
    expect(result.current.getLosingTeam()).toEqual(mockMatch.team2);
  });

  it('handles tie games', () => {
    const tieMatch = { ...mockMatch, score1: 15, score2: 15 };
    const { result } = renderHook(() => useRealtimeMatch({ autoFetch: false }));

    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: tieMatch, event: 'score_updated' });
    });

    expect(result.current.getWinningTeam()).toBeNull();
    expect(result.current.getLosingTeam()).toBeNull();
  });

  it('provides match status checks', () => {
    const { result } = renderHook(() => useRealtimeMatch({ autoFetch: false }));

    // Active match
    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: mockMatch, event: 'score_updated' });
    });

    expect(result.current.isMatchActive()).toBe(true);
    expect(result.current.isAwaitingConfirmation()).toBe(false);
    expect(result.current.isMatchComplete()).toBe(false);

    // Confirming match
    const confirmingMatch = { ...mockMatch, status: 'confirming' as const };
    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: confirmingMatch, event: 'match_ended' });
    });

    expect(result.current.isMatchActive()).toBe(false);
    expect(result.current.isAwaitingConfirmation()).toBe(true);
    expect(result.current.isMatchComplete()).toBe(false);

    // Completed match
    const completedMatch = { ...mockMatch, status: 'completed' as const };
    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: completedMatch, event: 'match_completed' });
    });

    expect(result.current.isMatchActive()).toBe(false);
    expect(result.current.isAwaitingConfirmation()).toBe(false);
    expect(result.current.isMatchComplete()).toBe(true);
  });

  it('provides confirmation status', () => {
    const { result } = renderHook(() => useRealtimeMatch({ autoFetch: false }));

    const confirmingMatch = { 
      ...mockMatch, 
      status: 'confirming' as const,
      confirmed: { team1: true, team2: false }
    };

    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: confirmingMatch, event: 'confirmation_received' });
    });

    const confirmationStatus = result.current.getConfirmationStatus();
    expect(confirmationStatus.team1Confirmed).toBe(true);
    expect(confirmationStatus.team2Confirmed).toBe(false);
    expect(confirmationStatus.bothConfirmed).toBe(false);

    // Both confirmed
    const bothConfirmedMatch = { 
      ...confirmingMatch,
      confirmed: { team1: true, team2: true }
    };

    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: bothConfirmedMatch, event: 'match_completed' });
    });

    const bothConfirmedStatus = result.current.getConfirmationStatus();
    expect(bothConfirmedStatus.bothConfirmed).toBe(true);
  });

  it('checks if target score is reached', () => {
    const { result } = renderHook(() => useRealtimeMatch({ autoFetch: false }));

    // Score below target
    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: mockMatch, event: 'score_updated' });
    });

    expect(result.current.hasReachedTargetScore()).toBe(false);

    // Score at target
    const targetReachedMatch = { ...mockMatch, score1: 21 };
    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: targetReachedMatch, event: 'score_updated' });
    });

    expect(result.current.hasReachedTargetScore()).toBe(true);
  });

  it('provides current score string', () => {
    const { result } = renderHook(() => useRealtimeMatch({ autoFetch: false }));

    // No match
    expect(result.current.currentScore).toBe('0-0');

    // With match
    act(() => {
      const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
      callback({ match: mockMatch, event: 'score_updated' });
    });

    expect(result.current.currentScore).toBe('15-12');
  });

  it('handles different match events', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { result } = renderHook(() => useRealtimeMatch({ autoFetch: false }));

    const events = [
      { event: 'score_updated', score: '15-12' },
      { event: 'match_ended' },
      { event: 'match_completed', winner: 'Team A', finalScore: '21-18' },
      { event: 'confirmation_received', waitingFor: 'Team B' },
      { event: 'match_timeout_resolved' }
    ];

    events.forEach(eventData => {
      act(() => {
        const callback = mockSocketOnMatchUpdate.mock.calls[0][0];
        callback({ match: mockMatch, ...eventData });
      });
    });

    expect(consoleSpy).toHaveBeenCalledWith('Score updated: 15-12');
    expect(consoleSpy).toHaveBeenCalledWith('Match ended, waiting for confirmation');
    expect(consoleSpy).toHaveBeenCalledWith('Match completed! Winner: Team A, Final Score: 21-18');
    expect(consoleSpy).toHaveBeenCalledWith('Confirmation received, waiting for: Team B');
    expect(consoleSpy).toHaveBeenCalledWith('Match resolved due to timeout');

    consoleSpy.mockRestore();
  });

  it('refetches data when refetch is called', async () => {
    const { result } = renderHook(() => useRealtimeMatch({ autoFetch: false }));

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetch).toHaveBeenCalledWith('/api/match/current');
    expect(result.current.currentMatch).toEqual(mockMatch);
  });

  it('handles empty match response', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          matches: []
        }
      })
    });

    const { result } = renderHook(() => useRealtimeMatch());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentMatch).toBeNull();
    expect(result.current.hasActiveMatch).toBe(false);
  });
});