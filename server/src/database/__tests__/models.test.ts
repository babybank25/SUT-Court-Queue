import { database } from '../connection';
import { migrationManager } from '../migrations';
import { TeamRepository, MatchRepository, CourtStatusRepository, QueueStateRepository } from '../models';
import { Team, Match } from '../../types';

describe('Database Models', () => {
  let teamRepo: TeamRepository;
  let matchRepo: MatchRepository;
  let courtStatusRepo: CourtStatusRepository;
  let queueStateRepo: QueueStateRepository;

  beforeAll(async () => {
    // Use in-memory database for testing
    await database.connect(':memory:');
    await migrationManager.migrate();
    
    teamRepo = new TeamRepository();
    matchRepo = new MatchRepository();
    courtStatusRepo = new CourtStatusRepository();
    queueStateRepo = new QueueStateRepository();
  });

  afterAll(async () => {
    await database.close();
  });

  describe('TeamRepository', () => {
    it('should create and retrieve a team', async () => {
      const teamData = {
        name: 'Test Team',
        members: 5,
        contactInfo: 'test@example.com',
        status: 'waiting' as const,
        wins: 0,
        position: 1,
      };

      const createdTeam = await teamRepo.create(teamData);
      expect(createdTeam.id).toBeDefined();
      expect(createdTeam.name).toBe(teamData.name);
      expect(createdTeam.members).toBe(teamData.members);
      expect(createdTeam.lastSeen).toBeInstanceOf(Date);

      const retrievedTeam = await teamRepo.findById(createdTeam.id);
      expect(retrievedTeam).toEqual(createdTeam);
    });

    it('should find team by name', async () => {
      const teamData = {
        name: 'Unique Team Name',
        members: 3,
        status: 'waiting' as const,
        wins: 2,
      };

      const createdTeam = await teamRepo.create(teamData);
      const foundTeam = await teamRepo.findByName('Unique Team Name');
      
      expect(foundTeam).toBeTruthy();
      expect(foundTeam!.id).toBe(createdTeam.id);
    });

    it('should update team data', async () => {
      const teamData = {
        name: 'Update Test Team',
        members: 4,
        status: 'waiting' as const,
        wins: 0,
      };

      const createdTeam = await teamRepo.create(teamData);
      const updatedTeam = await teamRepo.update(createdTeam.id, {
        wins: 5,
        status: 'playing',
      });

      expect(updatedTeam).toBeTruthy();
      expect(updatedTeam!.wins).toBe(5);
      expect(updatedTeam!.status).toBe('playing');
    });

    it('should get queued teams in order', async () => {
      // Create multiple teams with different positions
      await teamRepo.create({
        name: 'Team A',
        members: 5,
        status: 'waiting',
        wins: 0,
        position: 2,
      });

      await teamRepo.create({
        name: 'Team B',
        members: 4,
        status: 'waiting',
        wins: 0,
        position: 1,
      });

      const queuedTeams = await teamRepo.getQueuedTeams();
      expect(queuedTeams.length).toBeGreaterThanOrEqual(2);
      
      // Should be ordered by position
      const teamB = queuedTeams.find(t => t.name === 'Team B');
      const teamA = queuedTeams.find(t => t.name === 'Team A');
      
      expect(teamB?.position).toBe(1);
      expect(teamA?.position).toBe(2);
    });
  });

  describe('CourtStatusRepository', () => {
    it('should get and update court status', async () => {
      const courtStatus = await courtStatusRepo.get();
      expect(courtStatus.isOpen).toBeDefined();
      expect(courtStatus.timezone).toBe('Asia/Bangkok');
      expect(courtStatus.rateLimit).toBeDefined();

      const updatedStatus = await courtStatusRepo.update({
        isOpen: false,
        mode: 'champion-return',
      });

      expect(updatedStatus.isOpen).toBe(false);
      expect(updatedStatus.mode).toBe('champion-return');
    });
  });

  describe('QueueStateRepository', () => {
    it('should get queue state with teams', async () => {
      const queueState = await queueStateRepo.get();
      expect(queueState.teams).toBeInstanceOf(Array);
      expect(queueState.maxSize).toBe(20);
      expect(queueState.lastUpdated).toBeInstanceOf(Date);
    });

    it('should update queue state', async () => {
      const updatedState = await queueStateRepo.update({
        maxSize: 15,
      });

      expect(updatedState.maxSize).toBe(15);
    });
  });

  describe('MatchRepository', () => {
    it('should create and retrieve a match', async () => {
      // First create two teams
      const team1 = await teamRepo.create({
        name: 'Match Team 1',
        members: 5,
        status: 'playing',
        wins: 0,
      });

      const team2 = await teamRepo.create({
        name: 'Match Team 2',
        members: 4,
        status: 'playing',
        wins: 1,
      });

      const matchData = {
        team1,
        team2,
        score1: 10,
        score2: 8,
        status: 'active' as const,
        targetScore: 21,
        matchType: 'regular' as const,
        confirmed: {
          team1: false,
          team2: false,
        },
      };

      const createdMatch = await matchRepo.create(matchData);
      expect(createdMatch.id).toBeDefined();
      expect(createdMatch.team1.name).toBe('Match Team 1');
      expect(createdMatch.team2.name).toBe('Match Team 2');
      expect(createdMatch.startTime).toBeInstanceOf(Date);

      const retrievedMatch = await matchRepo.findById(createdMatch.id);
      expect(retrievedMatch).toBeTruthy();
      expect(retrievedMatch!.score1).toBe(10);
      expect(retrievedMatch!.score2).toBe(8);
    });

    it('should update match scores and status', async () => {
      // Create teams and match first
      const team1 = await teamRepo.create({
        name: 'Update Match Team 1',
        members: 5,
        status: 'playing',
        wins: 0,
      });

      const team2 = await teamRepo.create({
        name: 'Update Match Team 2',
        members: 4,
        status: 'playing',
        wins: 1,
      });

      const match = await matchRepo.create({
        team1,
        team2,
        score1: 0,
        score2: 0,
        status: 'active',
        targetScore: 21,
        matchType: 'regular',
        confirmed: { team1: false, team2: false },
      });

      const updatedMatch = await matchRepo.update(match.id, {
        score1: 15,
        score2: 12,
        status: 'confirming',
        confirmed: { team1: true, team2: false },
      });

      expect(updatedMatch).toBeTruthy();
      expect(updatedMatch!.score1).toBe(15);
      expect(updatedMatch!.score2).toBe(12);
      expect(updatedMatch!.status).toBe('confirming');
      expect(updatedMatch!.confirmed.team1).toBe(true);
      expect(updatedMatch!.confirmed.team2).toBe(false);
    });

    it('should find active matches', async () => {
      const activeMatches = await matchRepo.findActive();
      expect(activeMatches).toBeInstanceOf(Array);
      
      // All returned matches should have active status
      activeMatches.forEach(match => {
        expect(match.status).toBe('active');
      });
    });
  });
});