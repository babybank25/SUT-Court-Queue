import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeQueue } from '../useRealtimeQueue';
import { useSocketContext } from '../../contexts/SocketContext';
import { QueueUpdateData, Team } from '../../types';

// Mock the socket context
jest.mock('../../contexts/SocketContext');
const mockUseSocketContext = useSocketContext as jest.MockedFunction<typeof useSocketContext>;

// Mock fetch
global.fetch = jest.fn();

describe('useRealtimeQueue', () => {
  const mockOnQueueUpdate = jest.fn();
  const mockSocketOnQueueUpdate = jest.fn();

  const mockQueueData: QueueUpdateData = {
    teams: [
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
        status: 'playing',
        wins: 1,
        lastSeen: new Date(),
        position: 2
      }
    ],
    totalTeams: 2,
    availableSlots: 8
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSocketContext.mockReturnValue({
      onQueueUpdate: mockSocketOnQueueUpdate,
      isConnected: true,
      onMatchUpdate: jest.fn(),
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
          teams: mockQueueData.teams,
          totalTeams: mockQueueData.totalTeams,
          availableSlots: mockQueueData.availableSlots
        }
      })
    });
  });

  it('initializes with empty queue data', () => {
    const { result } = renderHook(() => useRealtimeQueue({ autoFetch: false }));

    expect(result.current.queueData).toEqual({
      teams: [],
      totalTeams: 0,
      availableSlots: 0
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches initial queue data when connected', async () => {
    const { result } = renderHook(() => useRealtimeQueue());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.queueData.teams).toHaveLength(2);
    expect(result.current.queueData.totalTeams).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRealtimeQueue());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('handles WebSocket queue updates', () => {
    const { result } = renderHook(() => useRealtimeQueue({ 
      onQueueUpdate: mockOnQueueUpdate,
      autoFetch: false 
    }));

    // Simulate WebSocket update
    const updateData: QueueUpdateData = {
      ...mockQueueData,
      event: 'team_joined'
    };

    act(() => {
      const callback = mockSocketOnQueueUpdate.mock.calls[0][0];
      callback(updateData);
    });

    expect(result.current.queueData).toEqual(updateData);
    expect(mockOnQueueUpdate).toHaveBeenCalledWith(updateData);
  });

  it('provides helper functions', () => {
    const { result } = renderHook(() => useRealtimeQueue({ autoFetch: false }));

    // Set some test data
    act(() => {
      const callback = mockSocketOnQueueUpdate.mock.calls[0][0];
      callback(mockQueueData);
    });

    // Test getTeamPosition
    expect(result.current.getTeamPosition('1')).toBe(1);
    expect(result.current.getTeamPosition('nonexistent')).toBeNull();

    // Test getTeamByName
    expect(result.current.getTeamByName('Team A')).toEqual(mockQueueData.teams[0]);
    expect(result.current.getTeamByName('Nonexistent')).toBeNull();

    // Test getWaitingTeams
    const waitingTeams = result.current.getWaitingTeams();
    expect(waitingTeams).toHaveLength(1);
    expect(waitingTeams[0].status).toBe('waiting');

    // Test getPlayingTeams
    const playingTeams = result.current.getPlayingTeams();
    expect(playingTeams).toHaveLength(1);
    expect(playingTeams[0].status).toBe('playing');

    // Test getCooldownTeams
    const cooldownTeams = result.current.getCooldownTeams();
    expect(cooldownTeams).toHaveLength(0);
  });

  it('provides computed values', () => {
    const { result } = renderHook(() => useRealtimeQueue({ autoFetch: false }));

    // Initially empty
    expect(result.current.hasTeams).toBe(false);
    expect(result.current.isQueueFull).toBe(true); // 0 available slots
    expect(result.current.queueLength).toBe(0);

    // After update
    act(() => {
      const callback = mockSocketOnQueueUpdate.mock.calls[0][0];
      callback(mockQueueData);
    });

    expect(result.current.hasTeams).toBe(true);
    expect(result.current.isQueueFull).toBe(false);
    expect(result.current.queueLength).toBe(2);
  });

  it('handles different queue events', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { result } = renderHook(() => useRealtimeQueue({ autoFetch: false }));

    const events = [
      'team_joined',
      'match_completed',
      'team_updated_by_admin',
      'team_deleted_by_admin',
      'queue_reordered_by_admin'
    ];

    events.forEach(event => {
      act(() => {
        const callback = mockSocketOnQueueUpdate.mock.calls[0][0];
        callback({ ...mockQueueData, event });
      });
    });

    expect(consoleSpy).toHaveBeenCalledWith('Team joined the queue');
    expect(consoleSpy).toHaveBeenCalledWith('Match completed, queue updated');
    expect(consoleSpy).toHaveBeenCalledWith('Team updated by admin');
    expect(consoleSpy).toHaveBeenCalledWith('Team deleted by admin');
    expect(consoleSpy).toHaveBeenCalledWith('Queue reordered by admin');

    consoleSpy.mockRestore();
  });

  it('refetches data when refetch is called', async () => {
    const { result } = renderHook(() => useRealtimeQueue({ autoFetch: false }));

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetch).toHaveBeenCalledWith('/api/queue');
    expect(result.current.queueData.teams).toHaveLength(2);
  });

  it('does not fetch when autoFetch is false and not connected', () => {
    mockUseSocketContext.mockReturnValue({
      onQueueUpdate: mockSocketOnQueueUpdate,
      isConnected: false,
      onMatchUpdate: jest.fn(),
      onCourtStatusUpdate: jest.fn(),
      onNotification: jest.fn(),
      emit: jest.fn(),
      socket: null
    });

    renderHook(() => useRealtimeQueue({ autoFetch: false }));

    expect(fetch).not.toHaveBeenCalled();
  });
});