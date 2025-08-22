import request from 'supertest';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import cors from 'cors';
import { initializeDatabase, closeDatabase } from '../../database';
import queueRouter from '../../routes/queue';
import matchRouter from '../../routes/match';
import adminRouter from '../../routes/admin';
import { setSocketInstance } from '../../services/socketService';
import {
  handleJoinRoom,
  handleJoinQueue,
  handleConfirmResult,
} from '../../services/socketHandlers';

describe('Complete User Journey Integration Tests', () => {
  let app: express.Application;
  let httpServer: Server;
  let ioServer: SocketIOServer;
  let adminToken: string;
  let serverPort: number;

  beforeAll(async () => {
    // Initialize test database
    await initializeDatabase(':memory:');

    // Set up Express app
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/queue', queueRouter);
    app.use('/api/match', matchRouter);
    app.use('/api/admin', adminRouter);

    // Set up HTTP server and Socket.IO
    httpServer = new Server(app);
    ioServer = new SocketIOServer(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });
    setSocketInstance(ioServer);

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        serverPort = (httpServer.address() as any)?.port;
        
        // Set up server socket handlers
        ioServer.on('connection', (socket) => {
          socket.on('join-room', (data) => handleJoinRoom(socket, data));
          socket.on('join-queue', (data) => handleJoinQueue(socket, data));
          socket.on('confirm-result', (data) => handleConfirmResult(socket, data));
        });
        
        resolve();
      });
    });

    // Get admin token
    try {
      const loginResponse = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      
      if (loginResponse.status === 200) {
        adminToken = loginResponse.body.data.token;
      }
    } catch (error) {
      adminToken = 'mock-admin-token';
    }
  });

  afterAll(async () => {
    ioServer.close();
    httpServer.close();
    await closeDatabase();
  });

  beforeEach(async () => {
    await initializeDatabase(':memory:');
  });

  describe('Complete Basketball Court Session Journey', () => {
    it('should handle a complete day at the basketball court', async () => {
      // === MORNING SETUP ===
      
      // 1. Admin checks court status
      const courtStatus = await request(app)
        .get('/api/court/status')
        .expect(200);

      expect(courtStatus.body.data.isOpen).toBe(true);

      // 2. First teams arrive and join queue
      const team1Response = await request(app)
        .post('/api/queue/join')
        .send({ 
          name: 'Morning Warriors', 
          members: 5, 
          contactInfo: 'warriors@morning.com' 
        })
        .expect(201);

      const team2Response = await request(app)
        .post('/api/queue/join')
        .send({ 
          name: 'Early Birds', 
          members: 4, 
          contactInfo: 'birds@early.com' 
        })
        .expect(201);

      // 3. More teams join throughout the morning
      const team3Response = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Sunrise Squad', members: 5 })
        .expect(201);

      const team4Response = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Dawn Breakers', members: 3 })
        .expect(201);

      // Verify queue state
      const morningQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(morningQueue.body.data.totalTeams).toBe(4);
      expect(morningQueue.body.data.teams[0].name).toBe('Morning Warriors');
      expect(morningQueue.body.data.teams[0].position).toBe(1);

      // === FIRST MATCH SESSION ===

      // 4. Admin starts first match
      const firstMatch = await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: team1Response.body.data.team.id,
          team2Id: team2Response.body.data.team.id,
          targetScore: 21,
          matchType: 'regular'
        })
        .expect(201);

      const firstMatchId = firstMatch.body.data.match.id;

      // 5. Match progresses with score updates
      const scoreProgression = [
        { score1: 3, score2: 2 },
        { score1: 8, score2: 5 },
        { score1: 12, score2: 10 },
        { score1: 18, score2: 15 },
        { score1: 21, score2: 17 }
      ];

      for (const scores of scoreProgression) {
        await request(app)
          .put(`/api/match/${firstMatchId}/score`)
          .send(scores)
          .expect(200);
        
        // Small delay to simulate real match timing
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 6. Teams confirm the result
      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: firstMatchId,
          teamId: team1Response.body.data.team.id,
          confirmed: true
        })
        .expect(200);

      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: firstMatchId,
          teamId: team2Response.body.data.team.id,
          confirmed: true
        })
        .expect(200);

      // Verify match completion
      const completedMatch = await request(app)
        .get(`/api/match/${firstMatchId}`)
        .expect(200);

      expect(completedMatch.body.data.match.status).toBe('completed');

      // === MIDDAY RUSH ===

      // 7. More teams join during busy period
      const rushTeams = [];
      for (let i = 5; i <= 8; i++) {
        const teamResponse = await request(app)
          .post('/api/queue/join')
          .send({ 
            name: `Rush Team ${i}`, 
            members: Math.floor(Math.random() * 3) + 3 // 3-5 members
          })
          .expect(201);
        rushTeams.push(teamResponse.body.data.team);
      }

      // 8. Start second match with next teams in queue
      const secondMatch = await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: team3Response.body.data.team.id,
          team2Id: team4Response.body.data.team.id,
          targetScore: 15, // Shorter game
          matchType: 'regular'
        })
        .expect(201);

      // 9. Simulate a disputed result scenario
      await request(app)
        .put(`/api/match/${secondMatch.body.data.match.id}/score`)
        .send({ score1: 15, score2: 13 })
        .expect(200);

      // Only one team confirms
      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: secondMatch.body.data.match.id,
          teamId: team3Response.body.data.team.id,
          confirmed: true
        })
        .expect(200);

      // Admin force resolves after timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      const forceResolve = await request(app)
        .post(`/api/admin/match/${secondMatch.body.data.match.id}/force-resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ finalScore1: 15, finalScore2: 13 })
        .expect(200);

      expect(forceResolve.body.data.match.status).toBe('completed');

      // === EVENING CHAMPION RETURN MODE ===

      // 10. Switch to champion return mode
      const championMatch = await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: rushTeams[0].id,
          team2Id: rushTeams[1].id,
          targetScore: 21,
          matchType: 'champion-return'
        })
        .expect(201);

      // 11. Champion wins and returns to queue
      await request(app)
        .put(`/api/match/${championMatch.body.data.match.id}/score`)
        .send({ score1: 21, score2: 18 })
        .expect(200);

      // Both teams confirm
      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: championMatch.body.data.match.id,
          teamId: rushTeams[0].id,
          confirmed: true
        })
        .expect(200);

      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: championMatch.body.data.match.id,
          teamId: rushTeams[1].id,
          confirmed: true
        })
        .expect(200);

      // === END OF DAY VERIFICATION ===

      // 12. Check final queue state
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      // Should have remaining teams plus champion
      expect(finalQueue.body.data.totalTeams).toBeGreaterThan(0);

      // 13. Admin checks daily statistics
      const adminDashboard = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminDashboard.body.data.matches.totalCompleted).toBe(3);
      expect(adminDashboard.body.data.teams.total).toBeGreaterThan(8);

      // 14. Verify match history
      const matchHistory = await request(app)
        .get('/api/admin/matches/history?limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(matchHistory.body.data.matches).toHaveLength(3);
      expect(matchHistory.body.data.matches[0].status).toBe('completed');
    });

    it('should handle error scenarios throughout the day', async () => {
      // 1. Team tries to join with invalid data
      await request(app)
        .post('/api/queue/join')
        .send({ name: '', members: 0 }) // Invalid data
        .expect(400);

      // 2. Valid team joins
      const validTeam = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Valid Team', members: 5 })
        .expect(201);

      // 3. Same team tries to join again
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'Valid Team', members: 4 }) // Duplicate name
        .expect(400);

      // 4. Admin tries to start match with insufficient teams
      await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: validTeam.body.data.team.id,
          team2Id: 'non-existent-id',
          targetScore: 21,
          matchType: 'regular'
        })
        .expect(400);

      // 5. Add another team and start valid match
      const secondTeam = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Second Team', members: 4 })
        .expect(201);

      const match = await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: validTeam.body.data.team.id,
          team2Id: secondTeam.body.data.team.id,
          targetScore: 21,
          matchType: 'regular'
        })
        .expect(201);

      // 6. Try to update score with invalid data
      await request(app)
        .put(`/api/match/${match.body.data.match.id}/score`)
        .send({ score1: -1, score2: 'invalid' }) // Invalid scores
        .expect(400);

      // 7. Valid score update
      await request(app)
        .put(`/api/match/${match.body.data.match.id}/score`)
        .send({ score1: 21, score2: 19 })
        .expect(200);

      // 8. Try to confirm with wrong team ID
      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: match.body.data.match.id,
          teamId: 'wrong-team-id',
          confirmed: true
        })
        .expect(400);

      // 9. Valid confirmation
      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: match.body.data.match.id,
          teamId: validTeam.body.data.team.id,
          confirmed: true
        })
        .expect(200);

      // 10. Try to access admin endpoint without auth
      await request(app)
        .get('/api/admin/dashboard')
        .expect(401);

      // 11. Try with invalid auth
      await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // 12. Valid admin access
      await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should handle concurrent operations during peak hours', async () => {
      // Simulate multiple teams trying to join simultaneously
      const concurrentJoins = Array.from({ length: 8 }, (_, i) => 
        request(app)
          .post('/api/queue/join')
          .send({ 
            name: `Peak Hour Team ${i + 1}`, 
            members: Math.floor(Math.random() * 3) + 3 
          })
      );

      const joinResults = await Promise.allSettled(concurrentJoins);
      const successfulJoins = joinResults.filter(
        result => result.status === 'fulfilled' && result.value.status === 201
      );

      // Most joins should succeed
      expect(successfulJoins.length).toBeGreaterThan(6);

      // Verify queue integrity
      const queueState = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(queueState.body.data.totalTeams).toBe(successfulJoins.length);

      // Verify all positions are unique and sequential
      const positions = queueState.body.data.teams.map(t => t.position);
      const expectedPositions = Array.from({ length: positions.length }, (_, i) => i + 1);
      expect(positions.sort()).toEqual(expectedPositions);

      // Start multiple matches if enough teams
      if (successfulJoins.length >= 4) {
        const teams = queueState.body.data.teams;
        
        const match1Promise = request(app)
          .post('/api/admin/match/start')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            team1Id: teams[0].id,
            team2Id: teams[1].id,
            targetScore: 15,
            matchType: 'regular'
          });

        const match2Promise = request(app)
          .post('/api/admin/match/start')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            team1Id: teams[2].id,
            team2Id: teams[3].id,
            targetScore: 15,
            matchType: 'regular'
          });

        const matchResults = await Promise.allSettled([match1Promise, match2Promise]);
        
        // At least one match should start successfully
        const successfulMatches = matchResults.filter(
          result => result.status === 'fulfilled' && result.value.status === 201
        );
        expect(successfulMatches.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should maintain data consistency across all operations', async () => {
      // Track all operations and verify consistency
      const operations = [];

      // 1. Initial state
      let queueState = await request(app).get('/api/queue').expect(200);
      operations.push({ type: 'initial', teams: queueState.body.data.totalTeams });

      // 2. Add teams
      for (let i = 1; i <= 5; i++) {
        const response = await request(app)
          .post('/api/queue/join')
          .send({ name: `Consistency Team ${i}`, members: 5 })
          .expect(201);
        
        operations.push({ 
          type: 'join', 
          teamId: response.body.data.team.id,
          teamName: `Consistency Team ${i}`
        });
      }

      // 3. Verify queue after joins
      queueState = await request(app).get('/api/queue').expect(200);
      expect(queueState.body.data.totalTeams).toBe(5);
      operations.push({ type: 'verify_queue', teams: 5 });

      // 4. Start match
      const teams = queueState.body.data.teams;
      const match = await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: teams[0].id,
          team2Id: teams[1].id,
          targetScore: 21,
          matchType: 'regular'
        })
        .expect(201);

      operations.push({ 
        type: 'start_match', 
        matchId: match.body.data.match.id,
        team1: teams[0].name,
        team2: teams[1].name
      });

      // 5. Verify queue after match start
      queueState = await request(app).get('/api/queue').expect(200);
      expect(queueState.body.data.totalTeams).toBe(3); // 2 teams moved to playing
      operations.push({ type: 'verify_queue_after_match', teams: 3 });

      // 6. Complete match
      await request(app)
        .put(`/api/match/${match.body.data.match.id}/score`)
        .send({ score1: 21, score2: 18 })
        .expect(200);

      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: match.body.data.match.id,
          teamId: teams[0].id,
          confirmed: true
        })
        .expect(200);

      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: match.body.data.match.id,
          teamId: teams[1].id,
          confirmed: true
        })
        .expect(200);

      operations.push({ type: 'complete_match', winner: teams[0].name });

      // 7. Final verification
      const finalQueue = await request(app).get('/api/queue').expect(200);
      const adminDashboard = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify data consistency
      expect(finalQueue.body.data.totalTeams).toBe(3); // Remaining teams
      expect(adminDashboard.body.data.matches.totalCompleted).toBe(1);
      expect(adminDashboard.body.data.teams.total).toBe(5); // All teams still exist

      operations.push({ 
        type: 'final_verification', 
        queueTeams: finalQueue.body.data.totalTeams,
        completedMatches: adminDashboard.body.data.matches.totalCompleted
      });

      // Log operations for debugging if needed
      console.log('Operations performed:', operations.length);
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should maintain real-time synchronization throughout complex workflows', async () => {
      // Create multiple WebSocket clients to simulate spectators
      const spectators = await Promise.all(
        Array.from({ length: 3 }, () => {
          return new Promise<ClientSocket>((resolve) => {
            const client = Client(`http://localhost:${serverPort}`);
            client.on('connect', () => resolve(client));
          });
        })
      );

      const allUpdates: { [index: number]: any[] } = {};
      
      // Set up event listeners
      spectators.forEach((client, index) => {
        allUpdates[index] = [];
        client.on('queue-updated', (data) => allUpdates[index].push({ type: 'queue', data }));
        client.on('match-updated', (data) => allUpdates[index].push({ type: 'match', data }));
        client.on('court-status', (data) => allUpdates[index].push({ type: 'court', data }));
        client.emit('join-room', { room: 'public' });
      });

      // Perform complex workflow
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Realtime Team 1', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Realtime Team 2', members: 4 })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 200));

      const match = await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: team1.body.data.team.id,
          team2Id: team2.body.data.team.id,
          targetScore: 15,
          matchType: 'regular'
        })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Multiple score updates
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .put(`/api/match/${match.body.data.match.id}/score`)
          .send({ score1: i * 3, score2: i * 2 })
          .expect(200);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Final score
      await request(app)
        .put(`/api/match/${match.body.data.match.id}/score`)
        .send({ score1: 15, score2: 12 })
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Confirm match
      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: match.body.data.match.id,
          teamId: team1.body.data.team.id,
          confirmed: true
        })
        .expect(200);

      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: match.body.data.match.id,
          teamId: team2.body.data.team.id,
          confirmed: true
        })
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify all spectators received updates
      spectators.forEach((client, index) => {
        expect(allUpdates[index].length).toBeGreaterThan(5);
        
        // Should have received queue updates
        const queueUpdates = allUpdates[index].filter(u => u.type === 'queue');
        expect(queueUpdates.length).toBeGreaterThan(0);
        
        // Should have received match updates
        const matchUpdates = allUpdates[index].filter(u => u.type === 'match');
        expect(matchUpdates.length).toBeGreaterThan(0);
        
        client.close();
      });
    });
  });
});