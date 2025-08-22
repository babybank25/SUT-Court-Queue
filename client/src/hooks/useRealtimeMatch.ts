import { useState, useEffect, useCallback } from 'react';
import { useSocketContext } from '../contexts/SocketContext';
import { MatchUpdateData, Match } from '../types';

interface UseRealtimeMatchOptions {
  onMatchUpdate?: (data: MatchUpdateData) => void;
  autoFetch?: boolean;
}

export const useRealtimeMatch = (options: UseRealtimeMatchOptions = {}) => {
  const { onMatchUpdate, autoFetch = true } = options;
  const { onMatchUpdate: socketOnMatchUpdate, isConnected } = useSocketContext();
  
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<MatchUpdateData | null>(null);

  // Handle match updates from WebSocket
  const handleMatchUpdate = useCallback((data: MatchUpdateData) => {
    console.log('Match update received:', data);
    
    setCurrentMatch(data.match);
    setLastUpdate(data);
    setError(null);
    
    // Call custom handler if provided
    if (onMatchUpdate) {
      onMatchUpdate(data);
    }
    
    // Log specific events
    switch (data.event) {
      case 'score_updated':
        console.log(`Score updated: ${data.score}`);
        break;
      case 'match_ended':
        console.log('Match ended, waiting for confirmation');
        break;
      case 'match_completed':
        console.log(`Match completed! Winner: ${data.winner}, Final Score: ${data.finalScore}`);
        break;
      case 'confirmation_received':
        console.log(`Confirmation received, waiting for: ${data.waitingFor}`);
        break;
      case 'match_timeout_resolved':
        console.log('Match resolved due to timeout');
        break;
      default:
        console.log('Match updated:', data.event);
    }
  }, [onMatchUpdate]);

  // Fetch current match data
  const fetchCurrentMatch = useCallback(async () => {
    if (!autoFetch) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/match/current');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        const activeMatch = result.data.matches.length > 0 ? result.data.matches[0] : null;
        setCurrentMatch(activeMatch);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch match data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching match data:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [autoFetch]);

  // Set up WebSocket listener and fetch initial data
  useEffect(() => {
    socketOnMatchUpdate(handleMatchUpdate);
    
    // Fetch initial data when connected
    if (isConnected && autoFetch) {
      fetchCurrentMatch();
    }
  }, [socketOnMatchUpdate, handleMatchUpdate, isConnected, fetchCurrentMatch, autoFetch]);

  // Helper functions
  const getMatchDuration = useCallback((): number => {
    if (!currentMatch) return 0;
    
    const endTime = currentMatch.endTime ? new Date(currentMatch.endTime) : new Date();
    const startTime = new Date(currentMatch.startTime);
    return Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60); // in minutes
  }, [currentMatch]);

  const getWinningTeam = useCallback(() => {
    if (!currentMatch) return null;
    
    if (currentMatch.score1 > currentMatch.score2) {
      return currentMatch.team1;
    } else if (currentMatch.score2 > currentMatch.score1) {
      return currentMatch.team2;
    }
    return null; // Tie
  }, [currentMatch]);

  const getLosingTeam = useCallback(() => {
    if (!currentMatch) return null;
    
    if (currentMatch.score1 < currentMatch.score2) {
      return currentMatch.team1;
    } else if (currentMatch.score2 < currentMatch.score1) {
      return currentMatch.team2;
    }
    return null; // Tie
  }, [currentMatch]);

  const isMatchComplete = useCallback((): boolean => {
    return currentMatch?.status === 'completed';
  }, [currentMatch]);

  const isMatchActive = useCallback((): boolean => {
    return currentMatch?.status === 'active';
  }, [currentMatch]);

  const isAwaitingConfirmation = useCallback((): boolean => {
    return currentMatch?.status === 'confirming';
  }, [currentMatch]);

  const getConfirmationStatus = useCallback() => {
    if (!currentMatch || currentMatch.status !== 'confirming') {
      return { team1Confirmed: false, team2Confirmed: false, bothConfirmed: false };
    }
    
    return {
      team1Confirmed: currentMatch.confirmed.team1,
      team2Confirmed: currentMatch.confirmed.team2,
      bothConfirmed: currentMatch.confirmed.team1 && currentMatch.confirmed.team2
    };
  }, [currentMatch]);

  const hasReachedTargetScore = useCallback((): boolean => {
    if (!currentMatch) return false;
    return currentMatch.score1 >= currentMatch.targetScore || currentMatch.score2 >= currentMatch.targetScore;
  }, [currentMatch]);

  return {
    currentMatch,
    isLoading,
    error,
    isConnected,
    lastUpdate,
    
    // Actions
    refetch: fetchCurrentMatch,
    
    // Helper functions
    getMatchDuration,
    getWinningTeam,
    getLosingTeam,
    getConfirmationStatus,
    
    // Status checks
    isMatchComplete,
    isMatchActive,
    isAwaitingConfirmation,
    hasReachedTargetScore,
    
    // Computed values
    hasActiveMatch: currentMatch !== null,
    currentScore: currentMatch ? `${currentMatch.score1}-${currentMatch.score2}` : '0-0',
    matchDuration: getMatchDuration()
  };
};