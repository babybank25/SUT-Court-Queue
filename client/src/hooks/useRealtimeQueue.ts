import { useState, useEffect, useCallback } from 'react';
import { useSocketContext } from '../contexts/SocketContext';
import { QueueUpdateData, Team } from '../types';

interface UseRealtimeQueueOptions {
  onQueueUpdate?: (data: QueueUpdateData) => void;
  autoFetch?: boolean;
}

export const useRealtimeQueue = (options: UseRealtimeQueueOptions = {}) => {
  const { onQueueUpdate, autoFetch = true } = options;
  const { onQueueUpdate: socketOnQueueUpdate, isConnected } = useSocketContext();
  
  const [queueData, setQueueData] = useState<QueueUpdateData>({
    teams: [],
    totalTeams: 0,
    availableSlots: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle queue updates from WebSocket
  const handleQueueUpdate = useCallback((data: QueueUpdateData) => {
    console.log('Queue update received:', data);
    
    setQueueData(data);
    setError(null);
    
    // Call custom handler if provided
    if (onQueueUpdate) {
      onQueueUpdate(data);
    }
    
    // Log specific events
    if (data.event) {
      switch (data.event) {
        case 'team_joined':
          console.log('Team joined the queue');
          break;
        case 'match_completed':
          console.log('Match completed, queue updated');
          break;
        case 'team_updated_by_admin':
          console.log('Team updated by admin');
          break;
        case 'team_deleted_by_admin':
          console.log('Team deleted by admin');
          break;
        case 'queue_reordered_by_admin':
          console.log('Queue reordered by admin');
          break;
        default:
          console.log('Queue updated:', data.event);
      }
    }
  }, [onQueueUpdate]);

  // Fetch initial queue data
  const fetchQueueData = useCallback(async () => {
    if (!autoFetch) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/queue');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setQueueData({
          teams: result.data.teams,
          totalTeams: result.data.totalTeams,
          availableSlots: result.data.availableSlots
        });
      } else {
        throw new Error(result.error?.message || 'Failed to fetch queue data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching queue data:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [autoFetch]);

  // Set up WebSocket listener and fetch initial data
  useEffect(() => {
    socketOnQueueUpdate(handleQueueUpdate);
    
    // Fetch initial data when connected
    if (isConnected && autoFetch) {
      fetchQueueData();
    }
  }, [socketOnQueueUpdate, handleQueueUpdate, isConnected, fetchQueueData, autoFetch]);

  // Helper functions
  const getTeamPosition = useCallback((teamId: string): number | null => {
    const team = queueData.teams.find(t => t.id === teamId);
    return team?.position || null;
  }, [queueData.teams]);

  const getTeamByName = useCallback((teamName: string): Team | null => {
    return queueData.teams.find(t => t.name === teamName) || null;
  }, [queueData.teams]);

  const getWaitingTeams = useCallback((): Team[] => {
    return queueData.teams.filter(t => t.status === 'waiting');
  }, [queueData.teams]);

  const getPlayingTeams = useCallback((): Team[] => {
    return queueData.teams.filter(t => t.status === 'playing');
  }, [queueData.teams]);

  const getCooldownTeams = useCallback((): Team[] => {
    return queueData.teams.filter(t => t.status === 'cooldown');
  }, [queueData.teams]);

  return {
    queueData,
    isLoading,
    error,
    isConnected,
    
    // Actions
    refetch: fetchQueueData,
    
    // Helper functions
    getTeamPosition,
    getTeamByName,
    getWaitingTeams,
    getPlayingTeams,
    getCooldownTeams,
    
    // Computed values
    hasTeams: queueData.totalTeams > 0,
    isQueueFull: queueData.availableSlots === 0,
    queueLength: queueData.totalTeams
  };
};