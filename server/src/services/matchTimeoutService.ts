import { Match } from '../types';
import { getMatchById, updateMatch } from '../database/models';
import { emitMatchUpdate, emitNotification } from './socketService';

interface TimeoutEntry {
  matchId: string;
  timeoutId: NodeJS.Timeout;
  startTime: Date;
  duration: number; // in milliseconds
}

class MatchTimeoutService {
  private timeouts: Map<string, TimeoutEntry> = new Map();
  private readonly DEFAULT_TIMEOUT_DURATION = 60 * 1000; // 60 seconds

  /**
   * Start a timeout for a match confirmation
   */
  startConfirmationTimeout(matchId: string, duration?: number): void {
    // Clear existing timeout if any
    this.clearTimeout(matchId);

    const timeoutDuration = duration || this.DEFAULT_TIMEOUT_DURATION;
    const startTime = new Date();

    const timeoutId = setTimeout(async () => {
      await this.handleTimeout(matchId);
    }, timeoutDuration);

    this.timeouts.set(matchId, {
      matchId,
      timeoutId,
      startTime,
      duration: timeoutDuration
    });

    console.log(`⏰ Started confirmation timeout for match ${matchId} (${timeoutDuration / 1000}s)`);
  }

  /**
   * Clear timeout for a match
   */
  clearTimeout(matchId: string): boolean {
    const entry = this.timeouts.get(matchId);
    if (entry) {
      clearTimeout(entry.timeoutId);
      this.timeouts.delete(matchId);
      console.log(`⏰ Cleared timeout for match ${matchId}`);
      return true;
    }
    return false;
  }

  /**
   * Get remaining time for a match timeout
   */
  getRemainingTime(matchId: string): number | null {
    const entry = this.timeouts.get(matchId);
    if (!entry) return null;

    const elapsed = Date.now() - entry.startTime.getTime();
    const remaining = entry.duration - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Check if a match has an active timeout
   */
  hasTimeout(matchId: string): boolean {
    return this.timeouts.has(matchId);
  }

  /**
   * Get all active timeouts
   */
  getActiveTimeouts(): string[] {
    return Array.from(this.timeouts.keys());
  }

  /**
   * Handle timeout expiration
   */
  private async handleTimeout(matchId: string): Promise<void> {
    try {
      console.log(`⏰ Handling timeout for match ${matchId}`);

      // Remove from our tracking
      this.timeouts.delete(matchId);

      // Get current match state
      const match = await getMatchById(matchId);
      if (!match) {
        console.warn(`⚠️ Match ${matchId} not found during timeout handling`);
        return;
      }

      // Only handle timeout if match is still in confirming state
      if (match.status !== 'confirming') {
        console.log(`⏰ Match ${matchId} is no longer in confirming state, skipping timeout`);
        return;
      }

      // Determine winner based on score
      let winner: { name: string; score: number };
      if (match.score1 > match.score2) {
        winner = { name: match.team1.name, score: match.score1 };
      } else if (match.score2 > match.score1) {
        winner = { name: match.team2.name, score: match.score2 };
      } else {
        // In case of tie, declare team1 as winner (or implement tie-breaking logic)
        winner = { name: match.team1.name, score: match.score1 };
      }

      // Update match to completed status with both confirmations set to true
      const updatedMatch = await updateMatch(matchId, {
        status: 'completed',
        endTime: new Date(),
        confirmed: {
          team1: true,
          team2: true
        }
      });

      if (!updatedMatch) {
        console.error(`❌ Failed to update match ${matchId} during timeout resolution`);
        return;
      }

      // Emit match update event
      emitMatchUpdate({
        match: updatedMatch,
        event: 'match_timeout_resolved',
        winner: winner.name,
        finalScore: `${match.score1}-${match.score2}`,
        resolvedBy: 'timeout'
      });

      // Send notification to all users
      emitNotification({
        type: 'info',
        title: 'Match Auto-Resolved',
        message: `Match between ${match.team1.name} and ${match.team2.name} was resolved due to confirmation timeout. Winner: ${winner.name}`,
        timestamp: new Date().toISOString(),
        duration: 8000
      });

      console.log(`✅ Match ${matchId} resolved due to timeout. Winner: ${winner.name}`);

    } catch (error) {
      console.error(`❌ Error handling timeout for match ${matchId}:`, error);
      
      // Send error notification
      emitNotification({
        type: 'error',
        title: 'Timeout Error',
        message: 'Failed to resolve match timeout. Please contact an admin.',
        timestamp: new Date().toISOString(),
        duration: 10000
      });
    }
  }

  /**
   * Clean up all timeouts (useful for shutdown)
   */
  cleanup(): void {
    console.log(`🧹 Cleaning up ${this.timeouts.size} active timeouts`);
    for (const [matchId, entry] of this.timeouts) {
      clearTimeout(entry.timeoutId);
    }
    this.timeouts.clear();
  }
}

// Export singleton instance
export const matchTimeoutService = new MatchTimeoutService();

// Export class for testing
export { MatchTimeoutService };