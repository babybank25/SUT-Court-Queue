import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeCourtStatus } from '../useRealtimeCourtStatus';
import { useSocketContext } from '../../contexts/SocketContext';
import { CourtStatus } from '../../types';

// Mock the socket context
jest.mock('../../contexts/SocketContext');
const mockUseSocketContext = useSocketContext as jest.MockedFunction<typeof useSocketContext>;

// Mock fetch
global.fetch = jest.fn();

describe('useRealtimeCourtStatus', () => {
  const mockOnCourtStatusUpdate = jest.fn();
  const mockSocketOnCourtStatusUpdate = jest.fn();

  const mockCourtStatus: CourtStatus = {
    isOpen: true,
    currentTime: '2024-01-01T10:30:45Z',
    timezone: 'Asia/Bangkok',
    mode: 'regular',
    activeMatches: 1,
    cooldownEnd: '2024-01-01T10:35:45Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSocketContext.mockReturnValue({
      onCourtStatusUpdate: mockSocketOnCourtStatusUpdate,
      isConnected: true,
      onQueueUpdate: jest.fn(),
      onMatchUpdate: jest.fn(),
      onNotification: jest.fn(),
      emit: jest.fn(),
      socket: null
    });

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockCourtStatus
      })
    });
  });

  it('initializes with default court status', () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    expect(result.current.courtStatus.isOpen).toBe(true);
    expect(result.current.courtStatus.mode).toBe('regular');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches initial court status when connected', async () => {
    const { result } = renderHook(() => useRealtimeCourtStatus());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.courtStatus).toEqual(mockCourtStatus);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRealtimeCourtStatus());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('handles WebSocket court status updates', () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ 
      onCourtStatusUpdate: mockOnCourtStatusUpdate,
      autoFetch: false 
    }));

    act(() => {
      const callback = mockSocketOnCourtStatusUpdate.mock.calls[0][0];
      callback(mockCourtStatus);
    });

    expect(result.current.courtStatus).toEqual(mockCourtStatus);
    expect(mockOnCourtStatusUpdate).toHaveBeenCalledWith(mockCourtStatus);
  });

  it('provides court status checks', () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    act(() => {
      const callback = mockSocketOnCourtStatusUpdate.mock.calls[0][0];
      callback(mockCourtStatus);
    });

    expect(result.current.isCourtOpen).toBe(true);
    expect(result.current.isRegularMode).toBe(true);
    expect(result.current.isChampionReturnMode).toBe(false);
    expect(result.current.hasActiveMatches).toBe(true);
    expect(result.current.activeMatchCount).toBe(1);
  });

  it('detects champion return mode', () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    const championReturnStatus = { ...mockCourtStatus, mode: 'champion-return' as const };

    act(() => {
      const callback = mockSocketOnCourtStatusUpdate.mock.calls[0][0];
      callback(championReturnStatus);
    });

    expect(result.current.isChampionReturnMode).toBe(true);
    expect(result.current.isRegularMode).toBe(false);
  });

  it('detects cooldown state', () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    // Mock current time to be before cooldown end
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T10:32:00Z').getTime());

    act(() => {
      const callback = mockSocketOnCourtStatusUpdate.mock.calls[0][0];
      callback(mockCourtStatus);
    });

    expect(result.current.isInCooldown()).toBe(true);
    expect(result.current.cooldownTimeRemaining).toBeGreaterThan(0);

    jest.restoreAllMocks();
  });

  it('calculates cooldown time remaining', () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    // Mock current time to be 2 minutes before cooldown end
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T10:33:45Z').getTime());

    act(() => {
      const callback = mockSocketOnCourtStatusUpdate.mock.calls[0][0];
      callback(mockCourtStatus);
    });

    expect(result.current.cooldownTimeRemaining).toBe(120); // 2 minutes in seconds

    jest.restoreAllMocks();
  });

  it('formats time correctly', () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    act(() => {
      const callback = mockSocketOnCourtStatusUpdate.mock.calls[0][0];
      callback(mockCourtStatus);
    });

    const formattedTime = result.current.getFormattedTime();
    expect(formattedTime).toMatch(/\d{2}:\d{2}:\d{2}/); // HH:MM:SS format
  });

  it('formats cooldown time correctly', () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    // Mock current time to be 2 minutes and 30 seconds before cooldown end
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T10:33:15Z').getTime());

    act(() => {
      const callback = mockSocketOnCourtStatusUpdate.mock.calls[0][0];
      callback(mockCourtStatus);
    });

    const formattedCooldownTime = result.current.getFormattedCooldownTime();
    expect(formattedCooldownTime).toBe('2:30');

    jest.restoreAllMocks();
  });

  it('handles no cooldown end time', () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    const statusWithoutCooldown = { ...mockCourtStatus, cooldownEnd: undefined };

    act(() => {
      const callback = mockSocketOnCourtStatusUpdate.mock.calls[0][0];
      callback(statusWithoutCooldown);
    });

    expect(result.current.isInCooldown()).toBe(false);
    expect(result.current.cooldownTimeRemaining).toBe(0);
    expect(result.current.getFormattedCooldownTime()).toBe('0:00');
  });

  it('handles closed court', () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    const closedCourtStatus = { ...mockCourtStatus, isOpen: false };

    act(() => {
      const callback = mockSocketOnCourtStatusUpdate.mock.calls[0][0];
      callback(closedCourtStatus);
    });

    expect(result.current.isCourtOpen).toBe(false);
  });

  it('refetches data when refetch is called', async () => {
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetch).toHaveBeenCalledWith('/api/court/status');
    expect(result.current.courtStatus).toEqual(mockCourtStatus);
  });

  it('does not fetch when autoFetch is false and not connected', () => {
    mockUseSocketContext.mockReturnValue({
      onCourtStatusUpdate: mockSocketOnCourtStatusUpdate,
      isConnected: false,
      onQueueUpdate: jest.fn(),
      onMatchUpdate: jest.fn(),
      onNotification: jest.fn(),
      emit: jest.fn(),
      socket: null
    });

    renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles API error response', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: { message: 'Server error' }
      })
    });

    const { result } = renderHook(() => useRealtimeCourtStatus());

    await waitFor(() => {
      expect(result.current.error).toBe('HTTP error! status: 500');
    });
  });

  it('updates time every second when connected', () => {
    jest.useFakeTimers();
    
    const { result } = renderHook(() => useRealtimeCourtStatus({ autoFetch: false }));

    act(() => {
      const callback = mockSocketOnCourtStatusUpdate.mock.calls[0][0];
      callback(mockCourtStatus);
    });

    const initialTime = result.current.getFormattedTime();

    // Fast forward 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const updatedTime = result.current.getFormattedTime();
    expect(updatedTime).not.toBe(initialTime);

    jest.useRealTimers();
  });
});