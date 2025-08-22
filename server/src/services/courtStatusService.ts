import { courtStatusRepository, matchRepository } from '../database';
import { emitCourtStatusUpdate } from './socketService';
import { CourtStatusData } from '../types';

export class CourtStatusService {
  
  // Get current court status and emit to clients
  async getCurrentStatusAndEmit(): Promise<void> {
    try {
      const [courtStatus, activeMatches] = await Promise.all([
        courtStatusRepository.get(),
        matchRepository.findActive()
      ]);
      
      const statusData: CourtStatusData = {
        isOpen: courtStatus.isOpen,
        currentTime: new Date().toISOString(),
        timezone: courtStatus.timezone,
        mode: courtStatus.mode,
        cooldownEnd: courtStatus.cooldownEnd?.toISOString(),
        activeMatches: activeMatches.length
      };
      
      emitCourtStatusUpdate(statusData);
      
    } catch (error) {
      console.error('Error getting court status:', error);
    }
  }
  
  // Update court status and emit changes
  async updateStatus(updates: Partial<{
    isOpen: boolean;
    mode: 'champion-return' | 'regular';
    cooldownEnd?: Date;
  }>): Promise<void> {
    try {
      await courtStatusRepository.update(updates);
      await this.getCurrentStatusAndEmit();
      
      console.log('Court status updated:', updates);
      
    } catch (error) {
      console.error('Error updating court status:', error);
      throw error;
    }
  }
  
  // Set champion return mode with cooldown
  async setChampionReturnMode(cooldownMinutes: number = 15): Promise<void> {
    const cooldownEnd = new Date();
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + cooldownMinutes);
    
    await this.updateStatus({
      mode: 'champion-return',
      cooldownEnd
    });
  }
  
  // Set regular mode
  async setRegularMode(): Promise<void> {
    await this.updateStatus({
      mode: 'regular',
      cooldownEnd: undefined
    });
  }
  
  // Open court
  async openCourt(): Promise<void> {
    await this.updateStatus({ isOpen: true });
  }
  
  // Close court
  async closeCourt(): Promise<void> {
    await this.updateStatus({ isOpen: false });
  }
  
  // Start periodic status updates (every 30 seconds)
  startPeriodicUpdates(): NodeJS.Timeout {
    return setInterval(async () => {
      await this.getCurrentStatusAndEmit();
    }, 30000); // 30 seconds
  }
}

// Export singleton instance
export const courtStatusService = new CourtStatusService();