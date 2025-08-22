import request from 'supertest';
import express from 'express';
import adminRouter from '../admin';
import { 
  teamRepository, 
  matchRepository, 
  queueStateRepository, 
  courtStatusRepository 
} from '../../database';
import { 
  generateToken, 
  validateAdminCredentials 
} from '../../middleware/auth';
import { courtStatusService } from '../../services/courtStatusService';

// Mock dependencies
jest.mock('../../database');
jest.mock('../../middleware/auth');
jest.mock('../../services/courtStatusService');
jest.mock('../../services/socketService');

const mockTeamRepository = teamRepository as jest.Mocked<typeof teamRepository>;
const mockMatchRepository = matchRepository as jest.Mocked<typeof matchRepository>;
const mockQueueStateRepository = queueStateRepository as jest.Mocked<typeof queueStateRepository>;
const mockCourtStatusRepository = courtStatusRepository as jest.Mocked<typeof courtStatusRepository>;
const mockGenerateToken = generateToken as jest.MockedFunction<typeof generateToken>;
const mockValidateAdminCredentials = validateAdminCredentials as jest.MockedFunction<typeof validateAdminCredentials>;
const mockCourtStatusService = courtStatusService as jest.Mocked<typeof courtStatusService>;

describe('Admin Routes', () => {
  let app: express.Application;
  let adminToken: string;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    
    // Mock admin token
    adminToken = 'mock-admin-token';
    
    jest.clearAllMocks();
  });

  describe('POST /api/admin/login', () => {
    it('should login with valid credentials', async () => {
      const mockAdmin = {
        id: '1',
        username: 'admin',
        password_hash: 'hashed',
        is_active: true,
        created_at: '2024-01-01',
        last_login: '2024-01-01'
      };

      const loginData = {
        username: 'admin',
        password: 'password'
      };

      mockValidateAdminCredentials.mockResolvedValue(mockAdmin);
      mockGenerateToken.mockReturnValue('jwt-token');

      const response = await request(app)
        .post('/api/admin/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          token: 'jwt-token',
          admin: {
            id: '1',
            username: 'admin'
          }
        }
      });

      expect(mockValidateAdminCredentials).toHaveBeenCalledWith('admin', 'password');
      expect(mockGenerateToken).toHaveBeenCalledWith({
        id: '1',
        username: 'admin',
        isAdmin: true
      });
    });

    it('should reject invalid credentials', async () => {
      mockValidateAdminCredentials.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'wrong' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS'
        }
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({ username: '', password: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Protected Routes', () => {
    beforeEach(() => {
      // Mock authentication middleware to pass
      jest.doMock('../../middleware/auth', () => ({
        ...jest.requireActual('../../middleware/auth'),
        authenticateToken: (req: any, res: any, next: any) => {
          req.user = { id: '1', username: 'admin', isAdmin: true };
          next();
        },
        requireAdmin: (req: any, res: any, next: any) => next()
      }));
    });

    describe('GET /api/admin/dashboard', () => {
      it('should return dashboard data', async () => {
        const mockQueueState = {
          teams: [{ id: '1', name: 'Team A' }],
          maxSize: 10
        };
        const mockActiveMatches = [{ id: '1', status: 'active' }];
        const mockCourtStatus = { isOpen: true, mode: 'regular' };
        const mockAllTeams = [
          { id: '1', status: 'waiting' },
          { id: '2', status: 'playing' },
          { id: '3', status: 'cooldown' }
        ];

        mockQueueStateRepository.get.mockResolvedValue(mockQueueState);
        mockMatchRepository.findActive.mockResolvedValue(mockActiveMatches);
        mockCourtStatusRepository.get.mockResolvedValue(mockCourtStatus);
        mockTeamRepository.findAll.mockResolvedValue(mockAllTeams);

        const response = await request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            queue: {
              teams: mockQueueState.teams,
              totalTeams: 1,
              maxSize: 10,
              availableSlots: 9
            },
            matches: {
              active: mockActiveMatches,
              totalActive: 1
            },
            court: {
              status: 'open',
              mode: 'regular'
            },
            teams: {
              total: 3,
              waiting: 1,
              playing: 1,
              cooldown: 1
            }
          }
        });
      });
    });

    describe('POST /api/admin/match/start', () => {
      it('should start a new match', async () => {
        const mockTeam1 = { id: '1', name: 'Team A', status: 'waiting' };
        const mockTeam2 = { id: '2', name: 'Team B', status: 'waiting' };
        const mockNewMatch = {
          id: '1',
          team1: mockTeam1,
          team2: mockTeam2,
          status: 'active'
        };

        const startMatchData = {
          team1Id: '1',
          team2Id: '2',
          targetScore: 15,
          matchType: 'regular'
        };

        mockTeamRepository.findById
          .mockResolvedValueOnce(mockTeam1)
          .mockResolvedValueOnce(mockTeam2);
        mockMatchRepository.create.mockResolvedValue(mockNewMatch);
        mockTeamRepository.update.mockResolvedValue(undefined);
        mockQueueStateRepository.update.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/admin/match/start')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(startMatchData)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            match: mockNewMatch
          }
        });

        expect(mockMatchRepository.create).toHaveBeenCalledWith({
          team1: mockTeam1,
          team2: mockTeam2,
          score1: 0,
          score2: 0,
          status: 'active',
          targetScore: 15,
          matchType: 'regular',
          confirmed: { team1: false, team2: false }
        });

        expect(mockTeamRepository.update).toHaveBeenCalledWith('1', { status: 'playing' });
        expect(mockTeamRepository.update).toHaveBeenCalledWith('2', { status: 'playing' });
      });

      it('should reject if teams not found', async () => {
        mockTeamRepository.findById
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);

        const response = await request(app)
          .post('/api/admin/match/start')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ team1Id: '999', team2Id: '998', targetScore: 15, matchType: 'regular' })
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'TEAM_NOT_FOUND'
          }
        });
      });

      it('should reject if teams not available', async () => {
        const mockTeam1 = { id: '1', name: 'Team A', status: 'playing' };
        const mockTeam2 = { id: '2', name: 'Team B', status: 'waiting' };

        mockTeamRepository.findById
          .mockResolvedValueOnce(mockTeam1)
          .mockResolvedValueOnce(mockTeam2);

        const response = await request(app)
          .post('/api/admin/match/start')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ team1Id: '1', team2Id: '2', targetScore: 15, matchType: 'regular' })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'TEAM_NOT_AVAILABLE'
          }
        });
      });
    });

    describe('POST /api/admin/match/:id/force-resolve', () => {
      it('should force resolve a match', async () => {
        const mockMatch = {
          id: '1',
          team1: { id: '1', name: 'Team A', wins: 5 },
          team2: { id: '2', name: 'Team B', wins: 3 },
          score1: 15,
          score2: 12,
          status: 'confirming',
          matchType: 'regular'
        };

        const resolvedMatch = {
          ...mockMatch,
          status: 'completed',
          endTime: new Date(),
          confirmed: { team1: true, team2: true }
        };

        mockMatchRepository.findById.mockResolvedValue(mockMatch);
        mockMatchRepository.update.mockResolvedValue(resolvedMatch);
        mockTeamRepository.update.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/admin/match/1/force-resolve')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            match: resolvedMatch,
            winner: 'Team A',
            finalScore: '15-12'
          }
        });

        expect(mockMatchRepository.update).toHaveBeenCalledWith('1', {
          status: 'completed',
          endTime: expect.any(Date),
          confirmed: { team1: true, team2: true }
        });
      });

      it('should reject if match already completed', async () => {
        const completedMatch = { id: '1', status: 'completed' };
        mockMatchRepository.findById.mockResolvedValue(completedMatch);

        const response = await request(app)
          .post('/api/admin/match/1/force-resolve')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'MATCH_ALREADY_COMPLETED'
          }
        });
      });
    });

    describe('GET /api/admin/teams', () => {
      it('should return paginated teams', async () => {
        const mockTeams = [
          { id: '1', name: 'Team A', status: 'waiting' },
          { id: '2', name: 'Team B', status: 'playing' }
        ];

        mockTeamRepository.findAll
          .mockResolvedValueOnce(mockTeams)
          .mockResolvedValueOnce(mockTeams);

        const response = await request(app)
          .get('/api/admin/teams?page=1&limit=10')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            teams: mockTeams,
            pagination: {
              page: 1,
              limit: 10,
              total: 2,
              totalPages: 1
            }
          }
        });
      });

      it('should filter teams by status', async () => {
        const waitingTeams = [{ id: '1', name: 'Team A', status: 'waiting' }];

        mockTeamRepository.findAll
          .mockResolvedValueOnce(waitingTeams)
          .mockResolvedValueOnce(waitingTeams);

        await request(app)
          .get('/api/admin/teams?status=waiting')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(mockTeamRepository.findAll).toHaveBeenCalledWith(
          { status: 'waiting', limit: 20, offset: 0 }
        );
      });
    });

    describe('PUT /api/admin/teams/:id', () => {
      it('should update team', async () => {
        const mockTeam = { id: '1', name: 'Team A', status: 'waiting' };
        const updatedTeam = { ...mockTeam, name: 'Updated Team A' };
        const updateData = { name: 'Updated Team A' };

        mockTeamRepository.findById.mockResolvedValue(mockTeam);
        mockTeamRepository.update.mockResolvedValue(updatedTeam);
        mockQueueStateRepository.get.mockResolvedValue({ teams: [], maxSize: 10 });

        const response = await request(app)
          .put('/api/admin/teams/1')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            team: updatedTeam
          }
        });

        expect(mockTeamRepository.update).toHaveBeenCalledWith('1', updateData);
      });

      it('should return 404 for non-existent team', async () => {
        mockTeamRepository.findById.mockResolvedValue(null);

        const response = await request(app)
          .put('/api/admin/teams/999')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Updated' })
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'TEAM_NOT_FOUND'
          }
        });
      });
    });

    describe('DELETE /api/admin/teams/:id', () => {
      it('should delete team', async () => {
        const mockTeam = { id: '1', name: 'Team A', status: 'waiting' };

        mockTeamRepository.findById.mockResolvedValue(mockTeam);
        mockTeamRepository.delete.mockResolvedValue(true);
        mockTeamRepository.getQueuedTeams.mockResolvedValue([]);
        mockTeamRepository.updatePositions.mockResolvedValue(undefined);
        mockQueueStateRepository.get.mockResolvedValue({ teams: [], maxSize: 10 });

        const response = await request(app)
          .delete('/api/admin/teams/1')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Team "Team A" deleted successfully'
        });

        expect(mockTeamRepository.delete).toHaveBeenCalledWith('1');
      });

      it('should reject deleting playing team', async () => {
        const playingTeam = { id: '1', name: 'Team A', status: 'playing' };
        mockTeamRepository.findById.mockResolvedValue(playingTeam);

        const response = await request(app)
          .delete('/api/admin/teams/1')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'TEAM_CURRENTLY_PLAYING'
          }
        });
      });
    });

    describe('PUT /api/admin/court/status', () => {
      it('should update court status', async () => {
        const updateData = { isOpen: false, mode: 'champion-return', cooldownMinutes: 15 };

        mockCourtStatusService.updateStatus.mockResolvedValue(undefined);

        const response = await request(app)
          .put('/api/admin/court/status')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Court status updated successfully'
        });

        expect(mockCourtStatusService.updateStatus).toHaveBeenCalledWith({
          isOpen: false,
          mode: 'champion-return',
          cooldownEnd: expect.any(Date)
        });
      });
    });

    describe('POST /api/admin/court/champion-mode', () => {
      it('should set champion return mode', async () => {
        mockCourtStatusService.setChampionReturnMode.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/admin/court/champion-mode')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ cooldownMinutes: 20 })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Champion return mode activated with 20 minute cooldown'
        });

        expect(mockCourtStatusService.setChampionReturnMode).toHaveBeenCalledWith(20);
      });
    });
  });
});