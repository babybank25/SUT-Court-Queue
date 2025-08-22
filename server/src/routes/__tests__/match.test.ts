import request from 'supertest';
import express from 'express';
import matchRouter from '../match';
import { matchRepository, teamRepository, queueStateRepository } from '../../database';
import { matchEventsRepository } from '../../database/matchEventsRepository';
import { emitMatchUpdate, emitQueueUpdate } from '../../services/socketService';
import { matchTimeoutService } from '../../services/matchTimeoutService';

// Mock dependencies
jest.mock('../../database');
jest.mock('../../database/matchEventsRepository');
jest.mock('../../services/socketService');
jest.mock('../../services/matchTimeoutService');

const mockMatchRepository = matchRepository as jest.Mocked<typeof matchRepository>;
const mockTeamRepository = teamRepository as jest.Mocked<typeof teamRepository>;
const mockQueueStateRepository = queueStateRepository as jest.Mocked<typeof queueStateRepository>;
const mockMatchEventsRepository = matchEventsRepository as jest.Mocked<typeof matchEventsRepository>;
const mockEmitMatchUpdate = emitMatchUpdate as jest.MockedFunction<typeof emitMatchUpdate>;
const mockEmitQueueUpdate = emitQueueUpdate as jest.MockedFunction<typeof emitQueueUpdate>;
const mockMatchTimeoutService = matchTimeoutService as jest.Mocked<typeof matchTimeoutService>;

describe('Match Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/match', matchRouter);
    
    jest.clearAllMocks();
  });

  describe('GET /api/match/current', () => {
    it('should return current active matches', async () => {
      const mockActiveMatches = [
        {
          id: '1',
          team1: { id: '1', name: 'Team A' },
          team2: { id: '2', name: 'Team B' },
          score1: 10,
          score2: 8,
          status: 'active'
        }
      ];

      mockMatchRepository.findActive.mockResolvedValue(mockActiveMatches);

      const response = await request(app)
        .get('/api/match/current')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          matches: mockActiveMatches,
          totalActiveMatches: 1,
          hasActiveMatch: true
        }
      });
    });

    it('should return empty array when no active matches', async () => {
      mockMatchRepository.findActive.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/match/current')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          matches: [],
          totalActiveMatches: 0,
          hasActiveMatch: false
        }
      });
    });
  });

  describe('GET /api/match/:id', () => {
    it('should return specific match details', async () => {
      const mockMatch = {
        id: '1',
        team1: { id: '1', name: 'Team A' },
        team2: { id: '2', name: 'Team B' },
        score1: 15,
        score2: 12,
        status: 'completed',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:30:00Z')
      };

      mockMatchRepository.findById.mockResolvedValue(mockMatch);

      const response = await request(app)
        .get('/api/match/1')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          match: mockMatch,
          duration: 30,
          isComplete: true,
          needsConfirmation: false
        }
      });
    });

    it('should calculate duration for active match', async () => {
      const startTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      const mockMatch = {
        id: '1',
        status: 'active',
        startTime,
        endTime: null
      };

      mockMatchRepository.findById.mockResolvedValue(mockMatch);

      const response = await request(app)
        .get('/api/match/1')
        .expect(200);

      expect(response.body.data.duration).toBe(15);
      expect(response.body.data.isComplete).toBe(false);
    });

    it('should return 404 for non-existent match', async () => {
      mockMatchRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/match/999')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND'
        }
      });
    });
  });

  describe('GET /api/match/:id/events', () => {
    it('should return match events', async () => {
      const mockMatch = { id: '1', status: 'active' };
      const mockEvents = [
        { id: '1', matchId: '1', eventType: 'score_update', timestamp: new Date() },
        { id: '2', matchId: '1', eventType: 'status_change', timestamp: new Date() }
      ];

      mockMatchRepository.findById.mockResolvedValue(mockMatch);
      mockMatchEventsRepository.findByMatchId.mockResolvedValue(mockEvents);

      const response = await request(app)
        .get('/api/match/1/events')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          events: mockEvents,
          matchId: '1',
          totalEvents: 2
        }
      });

      expect(mockMatchEventsRepository.findByMatchId).toHaveBeenCalledWith('1', 50);
    });

    it('should respect limit parameter', async () => {
      const mockMatch = { id: '1', status: 'active' };
      mockMatchRepository.findById.mockResolvedValue(mockMatch);
      mockMatchEventsRepository.findByMatchId.mockResolvedValue([]);

      await request(app)
        .get('/api/match/1/events?limit=10')
        .expect(200);

      expect(mockMatchEventsRepository.findByMatchId).toHaveBeenCalledWith('1', 10);
    });
  });

  describe('POST /api/match/confirm', () => {
    const mockMatch = {
      id: '1',
      team1: { id: '1', name: 'Team A', wins: 5 },
      team2: { id: '2', name: 'Team B', wins: 3 },
      score1: 15,
      score2: 12,
      status: 'confirming',
      confirmed: { team1: false, team2: false },
      matchType: 'regular',
      startTime: new Date()
    };

    it('should handle first team confirmation', async () => {
      const confirmData = {
        matchId: '1',
        teamId: '1',
        confirmed: true
      };

      const updatedMatch = {
        ...mockMatch,
        confirmed: { team1: true, team2: false }
      };

      mockMatchRepository.findById.mockResolvedValue(mockMatch);
      mockMatchRepository.update.mockResolvedValue(updatedMatch);
      mockMatchEventsRepository.create.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/match/confirm')
        .send(confirmData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          match: updatedMatch,
          waitingFor: 'Team B'
        }
      });

      expect(mockMatchRepository.update).toHaveBeenCalledWith('1', {
        confirmed: { team1: true, team2: false }
      });

      expect(mockEmitMatchUpdate).toHaveBeenCalledWith({
        match: updatedMatch,
        event: 'confirmation_received',
        waitingFor: 'Team B'
      });
    });

    it('should complete match when both teams confirm', async () => {
      const partiallyConfirmedMatch = {
        ...mockMatch,
        confirmed: { team1: true, team2: false }
      };

      const confirmData = {
        matchId: '1',
        teamId: '2',
        confirmed: true
      };

      const completedMatch = {
        ...mockMatch,
        status: 'completed',
        confirmed: { team1: true, team2: true },
        endTime: new Date()
      };

      mockMatchRepository.findById.mockResolvedValue(partiallyConfirmedMatch);
      mockMatchRepository.update
        .mockResolvedValueOnce({ ...partiallyConfirmedMatch, confirmed: { team1: true, team2: true } })
        .mockResolvedValueOnce(completedMatch);
      mockTeamRepository.update.mockResolvedValue(undefined);
      mockQueueStateRepository.get.mockResolvedValue({ teams: [], maxSize: 10 });
      mockMatchEventsRepository.create.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/match/confirm')
        .send(confirmData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          match: completedMatch,
          winner: 'Team A',
          finalScore: '15-12'
        }
      });

      expect(mockMatchTimeoutService.clearTimeout).toHaveBeenCalledWith('1');
      expect(mockTeamRepository.update).toHaveBeenCalledWith('1', { 
        status: 'waiting', 
        wins: 6 
      });
      expect(mockTeamRepository.update).toHaveBeenCalledWith('2', { 
        status: 'waiting' 
      });
    });

    it('should return 404 for non-existent match', async () => {
      mockMatchRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/match/confirm')
        .send({ matchId: '999', teamId: '1', confirmed: true })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND'
        }
      });
    });

    it('should reject confirmation for non-confirming match', async () => {
      const activeMatch = { ...mockMatch, status: 'active' };
      mockMatchRepository.findById.mockResolvedValue(activeMatch);

      const response = await request(app)
        .post('/api/match/confirm')
        .send({ matchId: '1', teamId: '1', confirmed: true })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MATCH_NOT_CONFIRMING'
        }
      });
    });

    it('should reject confirmation from team not in match', async () => {
      mockMatchRepository.findById.mockResolvedValue(mockMatch);

      const response = await request(app)
        .post('/api/match/confirm')
        .send({ matchId: '1', teamId: '999', confirmed: true })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TEAM_NOT_IN_MATCH'
        }
      });
    });

    it('should validate input data', async () => {
      const response = await request(app)
        .post('/api/match/confirm')
        .send({ matchId: '', teamId: '', confirmed: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/match/:id/score', () => {
    const mockMatch = {
      id: '1',
      team1: { id: '1', name: 'Team A' },
      team2: { id: '2', name: 'Team B' },
      score1: 10,
      score2: 8,
      status: 'active',
      targetScore: 15
    };

    it('should update match score', async () => {
      const updatedMatch = { ...mockMatch, score1: 12, score2: 10 };

      mockMatchRepository.findById.mockResolvedValue(mockMatch);
      mockMatchRepository.update.mockResolvedValue(updatedMatch);
      mockMatchEventsRepository.create.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/match/1/score')
        .send({ score1: 12, score2: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          match: updatedMatch,
          scoreUpdate: '12-10',
          needsConfirmation: false
        }
      });

      expect(mockMatchRepository.update).toHaveBeenCalledWith('1', {
        score1: 12,
        score2: 10,
        status: 'active'
      });

      expect(mockEmitMatchUpdate).toHaveBeenCalledWith({
        match: updatedMatch,
        event: 'score_updated',
        score: '12-10'
      });
    });

    it('should move to confirming when target score reached', async () => {
      const updatedMatch = { ...mockMatch, score1: 15, score2: 12, status: 'confirming' };

      mockMatchRepository.findById.mockResolvedValue(mockMatch);
      mockMatchRepository.update.mockResolvedValue(updatedMatch);
      mockMatchEventsRepository.create.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/match/1/score')
        .send({ score1: 15, score2: 12 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          match: updatedMatch,
          needsConfirmation: true
        }
      });

      expect(mockMatchRepository.update).toHaveBeenCalledWith('1', {
        score1: 15,
        score2: 12,
        status: 'confirming'
      });

      expect(mockMatchTimeoutService.startConfirmationTimeout).toHaveBeenCalledWith('1');
      expect(mockEmitMatchUpdate).toHaveBeenCalledWith({
        match: updatedMatch,
        event: 'match_ended',
        score: '15-12'
      });
    });

    it('should validate score values', async () => {
      const response = await request(app)
        .put('/api/match/1/score')
        .send({ score1: -1, score2: 'invalid' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_SCORE'
        }
      });
    });

    it('should reject updates for inactive matches', async () => {
      const inactiveMatch = { ...mockMatch, status: 'completed' };
      mockMatchRepository.findById.mockResolvedValue(inactiveMatch);

      const response = await request(app)
        .put('/api/match/1/score')
        .send({ score1: 12, score2: 10 })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MATCH_NOT_ACTIVE'
        }
      });
    });
  });

  describe('POST /api/match/:id/timeout', () => {
    const mockMatch = {
      id: '1',
      team1: { id: '1', name: 'Team A', wins: 5 },
      team2: { id: '2', name: 'Team B', wins: 3 },
      score1: 15,
      score2: 12,
      status: 'confirming',
      matchType: 'regular',
      startTime: new Date()
    };

    it('should resolve match timeout', async () => {
      const resolvedMatch = {
        ...mockMatch,
        status: 'completed',
        endTime: new Date(),
        confirmed: { team1: true, team2: true }
      };

      mockMatchRepository.findById.mockResolvedValue(mockMatch);
      mockMatchRepository.update.mockResolvedValue(resolvedMatch);
      mockTeamRepository.update.mockResolvedValue(undefined);
      mockMatchEventsRepository.create.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/match/1/timeout')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          match: resolvedMatch,
          winner: 'Team A',
          finalScore: '15-12',
          resolvedBy: 'timeout'
        }
      });

      expect(mockMatchRepository.update).toHaveBeenCalledWith('1', {
        status: 'completed',
        endTime: expect.any(Date),
        confirmed: { team1: true, team2: true }
      });

      expect(mockTeamRepository.update).toHaveBeenCalledWith('1', { 
        status: 'waiting', 
        wins: 6 
      });
    });

    it('should return 404 for non-existent match', async () => {
      mockMatchRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/match/999/timeout')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND'
        }
      });
    });

    it('should reject timeout for non-confirming match', async () => {
      const activeMatch = { ...mockMatch, status: 'active' };
      mockMatchRepository.findById.mockResolvedValue(activeMatch);

      const response = await request(app)
        .post('/api/match/1/timeout')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MATCH_NOT_CONFIRMING'
        }
      });
    });
  });
});