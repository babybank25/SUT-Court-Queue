import { useState, useEffect, useCallback } from 'react';
import { useSocketContext } from '../contexts/SocketContext';
import { CourtStatusData } from '../types';

interface UseRealtimeCourtStatusOptions {
  onCourtStatusUpdate?: (data: CourtStatusData) => void;
  autoFetch?: boolean;
}

export const useRealtimeCourtStatus = (options: UseRealtimeCourtStatusOptions = {}) => {
  const { onCourtStatusUpdate, autoFetch = true } = options;
  const { onCourtStatus: socketOnCourtStatus, isConnected } = useSocketContext();
  
  const [courtStatus, setCourtStatus] = useState<CourtStatusData>({
    isOpen: true,
    currentTime: new Date().toISOString(),
    timezone: 'Asia/Bangkok',
    mode: 'regular',
    activeMatches: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle court status updates from WebSocket
  const handleCourtStatusUpdate = useCallback((data: CourtStatusData) => {
    console.log('Court status update received:', data);
    
    setCourtStatus(data);
    setError(null);
    
    // Call custom handler if provided
    if (onCourtStatusUpdate) {
      onCourtStatusUpdate(data);
    }
    
    // Log status changes
    console.log(`Court is ${data.isOpen ? 'open' : 'closed'}, Mode: ${data.mode}, Active matches: ${data.activeMatches}`);
  }, [onCourtStatusUpdate]);

  // Fetch current court status
  const fetchCourtStatus = useCallback(async () => {
    if (!autoFetch) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // For now, we'll use the WebSocket data since there's no specific court status endpoint
      // In a real implementation, you might have a /api/court/status endpoint
      console.log('Court status will be received via WebSocket');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching court status:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [autoFetch]);

  // Set up WebSocket listener
  useEffect(() => {
    socketOnCourtStatus(handleCourtStatusUpdate);
    
    // Fetch initial data when connected
    if (isConnected && autoFetch) {
      fetchCourtStatus();
    }
  }, [socketOnCourtStatus, handleCourtStatusUpdate, isConnected, fetchCourtStatus, autoFetch]);

  // Helper functions
  const getCurrentTime = useCallback((): Date => {
    return new Date(courtStatus.currentTime);
  }, [courtStatus.currentTime]);

  const getFormattedTime = useCallback((): string => {
    const time = getCurrentTime();
    return time.toLocaleTimeString('th-TH', {
      timeZone: courtStatus.timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, [getCurrentTime, courtStatus.timezone]);

  const getCooldownTimeRemaining = useCallback((): number => {
    if (!courtStatus.cooldownEnd) return 0;
    
    const cooldownEnd = new Date(courtStatus.cooldownEnd);
    const now = getCurrentTime();
    const remaining = cooldownEnd.getTime() - now.getTime();
    
    return Math.max(0, Math.floor(remaining / 1000)); // in seconds
  }, [courtStatus.cooldownEnd, getCurrentTime]);

  const getFormattedCooldownTime = useCallback((): string => {
    const seconds = getCooldownTimeRemaining();
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, [getCooldownTimeRemaining]);

  const isInCooldown = useCallback((): boolean => {
    return courtStatus.mode === 'champion-return' && getCooldownTimeRemaining() > 0;
  }, [courtStatus.mode, getCooldownTimeRemaining]);

  const isChampionReturnMode = useCallback((): boolean => {
    return courtStatus.mode === 'champion-return';
  }, [courtStatus.mode]);

  const isRegularMode = useCallback((): boolean => {
    return courtStatus.mode === 'regular';
  }, [courtStatus.mode]);

  return {
    courtStatus,
    isLoading,
    error,
    isConnected,
    
    // Actions
    refetch: fetchCourtStatus,
    
    // Helper functions
    getCurrentTime,
    getFormattedTime,
    getCooldownTimeRemaining,
    getFormattedCooldownTime,
    
    // Status checks
    isCourtOpen: courtStatus.isOpen,
    isInCooldown,
    isChampionReturnMode,
    isRegularMode,
    hasActiveMatches: courtStatus.activeMatches > 0,
    
    // Computed values
    activeMatchCount: courtStatus.activeMatches,
    currentTimeFormatted: getFormattedTime(),
    cooldownTimeRemaining: getCooldownTimeRemaining()
  };
};