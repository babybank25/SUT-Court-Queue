import request from 'supertest';
import express from 'express';
import queueRouter from '../queue';
import { teamRepository, queueStateRepository } from '../../database';
import { emitQueueUpdate } from '../../services/socketService';
import { AppError } from '../../middleware';

// Mock dependencies
jest.mock('../../database');
jest.mock('../../services/socketService');

const mockTeamRepository = teamRepository as jest.Mocked<typeof teamRepository>;
const mockQueueStateRepository = queueStateRepository as jest.Mocked<typeof queueStateRepository>;
const mockEmitQueueUpdate = emitQueueUpdate as jest.MockedFunction<typeof emitQueueUpdate>;

describe('Queue Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/queue', queueRouter);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/queue', () => {
    it('should return current queue state', async () => {
      const mockQueueState = {
        teams: [
          { id: '1', name: 'Team A', position: 1, status: 'waiting', members: 5, wins: 0 },
          { id: '2', name: 'Team B', position: 2, status: 'waiting', members: 4, wins: 1 }
        ],
        maxSize: 10,
        currentMatch: null,
        lastUpdated: new Date()
      };

      mockQueueStateRepository.get.mockResolvedValue(mockQueueState);

      const response = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          teams: mockQueueState.teams,
          maxSize: 10,
          totalTeams: 2,
          availableSlots: 8
        }
      });
    });

    it('should handle database errors', async () => {
      mockQueueStateRepository.get.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/queue')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/queue/join', () => {
    const validJoinData = {
      name: 'Test Team',
      members: 5,
      contactInfo: 'test@example.com'
    };

    it('should successfully join queue with valid data', async () => {
      const mockQueueState = {
        teams: [],
        maxSize: 10,
        currentMatch: null,
        lastUpdated: new Date()
      };

      const mockNewTeam = {
        id: '1',
        name: 'Test Team',
        members: 5,
        contactInfo: 'test@example.com',
        status: 'waiting',
        wins: 0,
        position: 1
      };

      mockTeamRepository.findByName.mockResolvedValue(null);
      mockQueueStateRepository.get.mockResolvedValue(mockQueueState);
      mockTeamRepository.create.mockResolvedValue(mockNewTeam);

      const response = await request(app)
        .post('/api/queue/join')
        .send(validJoinData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          team: mockNewTeam,
          position: 1
        }
      });

      expect(mockTeamRepository.create).toHaveBeenCalledWith({
        name: 'Test Team',
        members: 5,
        contactInfo: 'test@example.com',
        status: 'waiting',
        wins: 0,
        position: 1
      });

      expect(mockEmitQueueUpdate).toHaveBeenCalled();
    });

    it('should reject duplicate team names', async () => {
      const existingTeam = { id: '1', name: 'Test Team' };
      mockTeamRepository.findByName.mockResolvedValue(existingTeam);

      const response = await request(app)
        .post('/api/queue/join')
        .send(validJoinData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TEAM_NAME_EXISTS'
        }
      });
    });

    it('should reject when queue is full', async () => {
      const mockQueueState = {
        teams: new Array(10).fill({}),
        maxSize: 10,
        currentMatch: null,
        lastUpdated: new Date()
      };

      mockTeamRepository.findByName.mockResolvedValue(null);
      mockQueueStateRepository.get.mockResolvedValue(mockQueueState);

      const response = await request(app)
        .post('/api/queue/join')
        .send(validJoinData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'QUEUE_FULL'
        }
      });
    });

    it('should validate required fields', async () => {
      const invalidData = { name: '', members: 0 };

      const response = await request(app)
        .post('/api/queue/join')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should calculate correct position for new team', async () => {
      const mockQueueState = {
        teams: [
          { id: '1', position: 1 },
          { id: '2', position: 3 }
        ],
        maxSize: 10,
        currentMatch: null,
        lastUpdated: new Date()
      };

      const mockNewTeam = {
        id: '3',
        name: 'Test Team',
        position: 4
      };

      mockTeamRepository.findByName.mockResolvedValue(null);
      mockQueueStateRepository.get.mockResolvedValue(mockQueueState);
      mockTeamRepository.create.mockResolvedValue(mockNewTeam);

      const response = await request(app)
        .post('/api/queue/join')
        .send(validJoinData)
        .expect(201);

      expect(mockTeamRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ position: 4 })
      );
    });
  });

  describe('DELETE /api/queue/leave/:teamId', () => {
    it('should successfully remove team from queue', async () => {
      const mockTeam = {
        id: '1',
        name: 'Test Team',
        status: 'waiting',
        position: 2
      };

      const mockRemainingTeams = [
        { id: '2', position: 3 },
        { id: '3', position: 4 }
      ];

      const mockUpdatedQueueState = {
        teams: mockRemainingTeams,
        maxSize: 10,
        currentMatch: null,
        lastUpdated: new Date()
      };

      mockTeamRepository.findById.mockResolvedValue(mockTeam);
      mockTeamRepository.delete.mockResolvedValue(true);
      mockTeamRepository.getQueuedTeams.mockResolvedValue(mockRemainingTeams);
      mockTeamRepository.updatePositions.mockResolvedValue(undefined);
      mockQueueStateRepository.get.mockResolvedValue(mockUpdatedQueueState);

      const response = await request(app)
        .delete('/api/queue/leave/1')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          removedTeam: mockTeam
        }
      });

      expect(mockTeamRepository.delete).toHaveBeenCalledWith('1');
      expect(mockTeamRepository.updatePositions).toHaveBeenCalledWith([
        { id: '2', position: 1 },
        { id: '3', position: 2 }
      ]);
      expect(mockEmitQueueUpdate).toHaveBeenCalled();
    });

    it('should return 404 for non-existent team', async () => {
      mockTeamRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/queue/leave/999')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND'
        }
      });
    });

    it('should reject removing team not in queue', async () => {
      const mockTeam = {
        id: '1',
        name: 'Test Team',
        status: 'playing'
      };

      mockTeamRepository.findById.mockResolvedValue(mockTeam);

      const response = await request(app)
        .delete('/api/queue/leave/1')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TEAM_NOT_IN_QUEUE'
        }
      });
    });
  });

  describe('GET /api/queue/position/:teamId', () => {
    it('should return team position information', async () => {
      const mockTeam = {
        id: '1',
        name: 'Test Team',
        status: 'waiting',
        position: 3
      };

      const mockQueuedTeams = [
        { id: '2', position: 1 },
        { id: '3', position: 2 },
        { id: '1', position: 3 }
      ];

      mockTeamRepository.findById.mockResolvedValue(mockTeam);
      mockTeamRepository.getQueuedTeams.mockResolvedValue(mockQueuedTeams);

      const response = await request(app)
        .get('/api/queue/position/1')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          team: {
            id: '1',
            name: 'Test Team',
            position: 3
          },
          teamsAhead: 2,
          estimatedWaitTime: '30 minutes'
        }
      });
    });

    it('should return 404 for non-existent team', async () => {
      mockTeamRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/queue/position/999')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND'
        }
      });
    });

    it('should reject team not in queue', async () => {
      const mockTeam = {
        id: '1',
        name: 'Test Team',
        status: 'playing'
      };

      mockTeamRepository.findById.mockResolvedValue(mockTeam);

      const response = await request(app)
        .get('/api/queue/position/1')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TEAM_NOT_IN_QUEUE'
        }
      });
    });
  });
});