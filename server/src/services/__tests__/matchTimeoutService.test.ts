import { MatchTimeoutService } from '../matchTimeoutService';
import { getMatchById, updateMatch } from '../../database/models';
import { emitMatchUpdate, emitNotification } from '../socketService';

// Mock dependencies
jest.mock('../../database/models');
jest.mock('../socketService');

const mockGetMatchById = getMatchById as jest.MockedFunction<typeof getMatchById>;
const mockUpdateMatch = updateMatch as jest.MockedFunction<typeof updateMatch>;
const mockEmitMatchUpdate = emitMatchUpdate as jest.MockedFunction<typeof emitMatchUpdate>;
const mockEmitNotification = emitNotification as jest.MockedFunction<typeof emitNotification>;

describe('MatchTimeoutService', () => {
  let service: MatchTimeoutService;

  beforeEach(() => {
    service = new MatchTimeoutService();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    service.cleanup();
    jest.useRealTimers();
  });

  const mockMatch = {
    id: 'match-1',
    team1: { id: 'team-1', name: 'Team Alpha', members: 5, status: 'playing' as const, wins: 3, lastSeen: new Date() },
    team2: { id: 'team-2', name: 'Team Beta', members: 4, status: 'playing' as const, wins: 2, lastSeen: new Date() },
    score1: 21,
    score2: 18,
    status: 'confirming' as const,
    startTime: new Date(),
    targetScore: 21,
    matchType: 'regular' as const,
    confirmed: { team1: false, team2: false }
  };

  describe('startConfirmationTimeout', () => {
    it('should start a timeout for a match', () => {
      service.startConfirmationTimeout('match-1');
      
      expect(service.hasTimeout('match-1')).toBe(true);
      expect(service.getActiveTimeouts()).toContain('match-1');
    });

    it('should use custom duration when provided', () => {
      service.startConfirmationTimeout('match-1', 30000); // 30 seconds
      
      expect(service.hasTimeout('match-1')).toBe(true);
      const remaining = service.getRemainingTime('match-1');
      expect(remaining).toBeGreaterThan(29000);
      expect(remaining).toBeLessThanOrEqual(30000);
    });

    it('should clear existing timeout when starting new one', () => {
      service.startConfirmationTimeout('match-1', 60000);
      const firstRemaining = service.getRemainingTime('match-1');
      
      // Start new timeout
      service.startConfirmationTimeout('match-1', 30000);
      const secondRemaining = service.getRemainingTime('match-1');
      
      expect(secondRemaining).toBeLessThan(firstRemaining!);
    });
  });

  describe('clearTimeout', () => {
    it('should clear an existing timeout', () => {
      service.startConfirmationTimeout('match-1');
      expect(service.hasTimeout('match-1')).toBe(true);
      
      const cleared = service.clearTimeout('match-1');
      expect(cleared).toBe(true);
      expect(service.hasTimeout('match-1')).toBe(false);
    });

    it('should return false when clearing non-existent timeout', () => {
      const cleared = service.clearTimeout('non-existent');
      expect(cleared).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return remaining time for active timeout', () => {
      service.startConfirmationTimeout('match-1', 60000);
      
      const remaining = service.getRemainingTime('match-1');
      expect(remaining).toBeGreaterThan(59000);
      expect(remaining).toBeLessThanOrEqual(60000);
    });

    it('should return null for non-existent timeout', () => {
      const remaining = service.getRemainingTime('non-existent');
      expect(remaining).toBeNull();
    });

    it('should return decreasing time as timeout progresses', () => {
      service.startConfirmationTimeout('match-1', 60000);
      
      const initial = service.getRemainingTime('match-1');
      jest.advanceTimersByTime(5000); // Advance 5 seconds
      const later = service.getRemainingTime('match-1');
      
      expect(later).toBeLessThan(initial!);
      expect(initial! - later!).toBeCloseTo(5000, -2); // Within 100ms
    });
  });

  describe('timeout handling', () => {
    it('should resolve match when timeout expires', async () => {
      mockGetMatchById.mockResolvedValue(mockMatch);
      mockUpdateMatch.mockResolvedValue({
        ...mockMatch,
        status: 'completed',
        endTime: new Date(),
        confirmed: { team1: true, team2: true }
      });

      service.startConfirmationTimeout('match-1', 1000); // 1 second
      
      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(1000);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockGetMatchById).toHaveBeenCalledWith('match-1');
      expect(mockUpdateMatch).toHaveBeenCalledWith('match-1', {
        status: 'completed',
        endTime: expect.any(Date),
        confirmed: { team1: true, team2: true }
      });
      expect(mockEmitMatchUpdate).toHaveBeenCalled();
      expect(mockEmitNotification).toHaveBeenCalled();
    });

    it('should not resolve match if it is no longer in confirming state', async () => {
      const completedMatch = { ...mockMatch, status: 'completed' as const };
      mockGetMatchById.mockResolvedValue(completedMatch);

      service.startConfirmationTimeout('match-1', 1000);
      
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockGetMatchById).toHaveBeenCalledWith('match-1');
      expect(mockUpdateMatch).not.toHaveBeenCalled();
    });

    it('should handle match not found during timeout', async () => {
      mockGetMatchById.mockResolvedValue(null);

      service.startConfirmationTimeout('match-1', 1000);
      
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockGetMatchById).toHaveBeenCalledWith('match-1');
      expect(mockUpdateMatch).not.toHaveBeenCalled();
    });

    it('should determine winner correctly based on score', async () => {
      const matchWithTeam2Winning = {
        ...mockMatch,
        score1: 18,
        score2: 21
      };
      mockGetMatchById.mockResolvedValue(matchWithTeam2Winning);
      mockUpdateMatch.mockResolvedValue({
        ...matchWithTeam2Winning,
        status: 'completed',
        endTime: new Date(),
        confirmed: { team1: true, team2: true }
      });

      service.startConfirmationTimeout('match-1', 1000);
      
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockEmitMatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'match_timeout_resolved',
          winner: 'Team Beta',
          finalScore: '18-21'
        })
      );
    });
  });

  describe('cleanup', () => {
    it('should clear all active timeouts', () => {
      service.startConfirmationTimeout('match-1');
      service.startConfirmationTimeout('match-2');
      service.startConfirmationTimeout('match-3');
      
      expect(service.getActiveTimeouts()).toHaveLength(3);
      
      service.cleanup();
      
      expect(service.getActiveTimeouts()).toHaveLength(0);
    });
  });
});