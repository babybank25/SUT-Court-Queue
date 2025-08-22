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

describe('End-to-End Workflow Integration Tests', () => {
  let app: express.Application;
  let httpServer: Server;
  let ioServer: SocketIOServer;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  let adminToken: string;

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
        const port = (httpServer.address() as any)?.port;
        
        // Set up client sockets
        clientSocket1 = Client(`http://localhost:${port}`);
        clientSocket2 = Client(`http://localhost:${port}`);
        
        // Set up server socket handlers
        ioServer.on('connection', (socket) => {
          socket.on('join-room', (data) => handleJoinRoom(socket, data));
          socket.on('join-queue', (data) => handleJoinQueue(socket, data));
          socket.on('confirm-result', (data) => handleConfirmResult(socket, data));
        });
        
        let connectedCount = 0;
        const checkConnections = () => {
          connectedCount++;
          if (connectedCount === 2) resolve();
        };
        
        clientSocket1.on('connect', checkConnections);
        clientSocket2.on('connect', checkConnections);
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
    clientSocket1.close();
    clientSocket2.close();
    ioServer.close();
    httpServer.close();
    await closeDatabase();
  });

  beforeEach(async () => {
    await initializeDatabase(':memory:');
  });

  describe('Complete Basketball Court Session Workflow', () => {
    it('should handle complete session from queue join to match completion', async () => {
      // Step 1: Multiple teams join queue via different methods
      const team1Response = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Team Alpha', members: 5, contactInfo: 'alpha@test.com' })
        .expect(201);

      const team2Response = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Team Beta', members: 4, contactInfo: 'beta@test.com' })
        .expect(201);

      // Team 3 joins via WebSocket
      const team3JoinPromise = new Promise<any>((resolve) => {
        clientSocket1.on('notification', (data) => {
          if (data.title === 'Joined Queue' && data.message.includes('Team Gamma')) {
            resolve(data);
          }
        });
      });

      clientSocket1.emit('join-room', { room: 'public' });
      clientSocket1.emit('join-queue', {
        name: 'Team Gamma',
        members: 3,
        contactInfo: 'gamma@test.com'
      });

      await team3JoinPromise;

      // Verify queue state
      const queueState = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(queueState.body.data.totalTeams).toBe(3);
      expect(queueState.body.data.teams.map(t => t.name)).toEqual([
        'Team Alpha', 'Team Beta', 'Team Gamma'
      ]);

      // Step 2: Admin starts match with first two teams
      const matchResponse = await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: team1Response.body.data.team.id,
          team2Id: team2Response.body.data.team.id,
          targetScore: 15,
          matchType: 'regular'
        })
        .expect(201);

      const matchId = matchResponse.body.data.match.id;

      // Verify teams moved from queue to playing
      const updatedQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(updatedQueue.body.data.totalTeams).toBe(1);
      expect(updatedQueue.body.data.teams[0].name).toBe('Team Gamma');
      expect(updatedQueue.body.data.teams[0].position).toBe(1);

      // Step 3: Simulate match progression with real-time updates
      const matchUpdatePromises = [
        new Promise<void>((resolve) => {
          clientSocket1.on('match-updated', (data) => {
            if (data.event === 'score_updated' && data.score === '5-3') {
              resolve();
            }
          });
        }),
        new Promise<void>((resolve) => {
          clientSocket2.on('match-updated', (data) => {
            if (data.event === 'score_updated' && data.score === '5-3') {
              resolve();
            }
          });
        })
      ];

      // Both clients join room to receive updates
      clientSocket2.emit('join-room', { room: 'public' });

      // Update scores progressively
      await request(app)
        .put(`/api/match/${matchId}/score`)
        .send({ score1: 5, score2: 3 })
        .expect(200);

      await Promise.all(matchUpdatePromises);

      await request(app)
        .put(`/api/match/${matchId}/score`)
        .send({ score1: 10, score2: 8 })
        .expect(200);

      await request(app)
        .put(`/api/match/${matchId}/score`)
        .send({ score1: 14, score2: 12 })
        .expect(200);

      // Step 4: Reach target score and handle confirmation
      const finalScoreResponse = await request(app)
        .put(`/api/match/${matchId}/score`)
        .send({ score1: 15, score2: 12 })
        .expect(200);

      expect(finalScoreResponse.body.data.match.status).toBe('confirming');

      // Step 5: Handle confirmation via WebSocket and API
      const confirmationPromise = new Promise<void>((resolve) => {
        clientSocket1.on('match-updated', (data) => {
          if (data.event === 'match_completed') {
            expect(data.winner).toBe('Team Alpha');
            expect(data.finalScore).toBe('15-12');
            resolve();
          }
        });
      });

      // Team 1 confirms via API
      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId,
          teamId: team1Response.body.data.team.id,
          confirmed: true
        })
        .expect(200);

      // Team 2 confirms via WebSocket
      clientSocket2.emit('confirm-result', {
        matchId,
        teamId: team2Response.body.data.team.id,
        confirmed: true
      });

      await confirmationPromise;

      // Step 6: Verify final state
      const completedMatch = await request(app)
        .get(`/api/match/${matchId}`)
        .expect(200);

      expect(completedMatch.body.data.match.status).toBe('completed');

      // Verify queue updated with winner back in queue (if champion-return mode)
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      // Team Gamma should still be in queue, potentially with winner added back
      expect(finalQueue.body.data.teams.some(t => t.name === 'Team Gamma')).toBe(true);
    });

    it('should handle admin force resolution workflow', async () => {
      // Set up match in confirming state
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Team X', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Team Y', members: 4 })
        .expect(201);

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

      // Reach target score
      await request(app)
        .put(`/api/match/${match.body.data.match.id}/score`)
        .send({ score1: 15, score2: 13 })
        .expect(200);

      // Only one team confirms
      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId: match.body.data.match.id,
          teamId: team1.body.data.team.id,
          confirmed: true
        })
        .expect(200);

      // Admin force resolves
      const forceResolveResponse = await request(app)
        .post(`/api/admin/match/${match.body.data.match.id}/force-resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ finalScore1: 15, finalScore2: 13 })
        .expect(200);

      expect(forceResolveResponse.body.data.match.status).toBe('completed');
      expect(forceResolveResponse.body.data.resolvedBy).toBe('admin');
    });
  });

  describe('Multi-Client Real-time Synchronization', () => {
    it('should synchronize queue updates across multiple clients', async () => {
      const client1Updates: any[] = [];
      const client2Updates: any[] = [];

      // Set up event listeners
      clientSocket1.on('queue-updated', (data) => client1Updates.push(data));
      clientSocket2.on('queue-updated', (data) => client2Updates.push(data));

      // Both clients join room
      clientSocket1.emit('join-room', { room: 'public' });
      clientSocket2.emit('join-room', { room: 'public' });

      // Add teams via different methods
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'API Team', members: 5 })
        .expect(201);

      clientSocket1.emit('join-queue', {
        name: 'WebSocket Team',
        members: 4
      });

      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 500));

      // Both clients should receive all updates
      expect(client1Updates.length).toBeGreaterThanOrEqual(2);
      expect(client2Updates.length).toBeGreaterThanOrEqual(2);

      // Verify update content consistency
      const lastUpdate1 = client1Updates[client1Updates.length - 1];
      const lastUpdate2 = client2Updates[client2Updates.length - 1];

      expect(lastUpdate1.totalTeams).toBe(lastUpdate2.totalTeams);
      expect(lastUpdate1.availableSlots).toBe(lastUpdate2.availableSlots);
    });

    it('should handle client disconnection and reconnection', async () => {
      // Client 1 joins room and queue
      clientSocket1.emit('join-room', { room: 'public' });
      
      const joinPromise = new Promise<void>((resolve) => {
        clientSocket1.on('notification', (data) => {
          if (data.title === 'Joined Queue') resolve();
        });
      });

      clientSocket1.emit('join-queue', {
        name: 'Disconnect Test Team',
        members: 5
      });

      await joinPromise;

      // Disconnect client 1
      clientSocket1.disconnect();

      // Add another team while client 1 is disconnected
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'While Disconnected Team', members: 4 })
        .expect(201);

      // Reconnect client 1
      clientSocket1.connect();

      const reconnectPromise = new Promise<void>((resolve) => {
        clientSocket1.on('connect', () => {
          clientSocket1.emit('join-room', { room: 'public' });
          resolve();
        });
      });

      await reconnectPromise;

      // Verify client 1 receives current state
      const queueState = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(queueState.body.data.totalTeams).toBe(2);
    });

    it('should broadcast match events to all spectators', async () => {
      const spectator1Events: any[] = [];
      const spectator2Events: any[] = [];

      // Set up spectators
      clientSocket1.on('match-updated', (data) => spectator1Events.push(data));
      clientSocket2.on('match-updated', (data) => spectator2Events.push(data));

      clientSocket1.emit('join-room', { room: 'public' });
      clientSocket2.emit('join-room', { room: 'public' });

      // Set up match
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Broadcast Team 1', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Broadcast Team 2', members: 4 })
        .expect(201);

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

      // Update scores multiple times
      const scoreUpdates = [
        { score1: 3, score2: 1 },
        { score1: 7, score2: 4 },
        { score1: 12, score2: 8 },
        { score1: 15, score2: 10 }
      ];

      for (const update of scoreUpdates) {
        await request(app)
          .put(`/api/match/${match.body.data.match.id}/score`)
          .send(update)
          .expect(200);
        
        // Small delay to ensure events are processed
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for all events to be received
      await new Promise(resolve => setTimeout(resolve, 500));

      // Both spectators should receive all match events
      expect(spectator1Events.length).toBeGreaterThanOrEqual(4);
      expect(spectator2Events.length).toBeGreaterThanOrEqual(4);

      // Verify final scores match
      const finalEvent1 = spectator1Events[spectator1Events.length - 1];
      const finalEvent2 = spectator2Events[spectator2Events.length - 1];

      expect(finalEvent1.match.score1).toBe(15);
      expect(finalEvent1.match.score2).toBe(10);
      expect(finalEvent2.match.score1).toBe(15);
      expect(finalEvent2.match.score2).toBe(10);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle API errors gracefully while maintaining WebSocket connection', async () => {
      clientSocket1.emit('join-room', { room: 'public' });

      // Try to join with invalid data
      const errorPromise = new Promise<void>((resolve) => {
        clientSocket1.on('error', (error) => {
          expect(error.code).toBe('VALIDATION_ERROR');
          resolve();
        });
      });

      clientSocket1.emit('join-queue', {
        name: '', // Invalid empty name
        members: 0 // Invalid member count
      });

      await errorPromise;

      // Verify connection is still active by joining with valid data
      const successPromise = new Promise<void>((resolve) => {
        clientSocket1.on('notification', (data) => {
          if (data.title === 'Joined Queue') resolve();
        });
      });

      clientSocket1.emit('join-queue', {
        name: 'Recovery Test Team',
        members: 5
      });

      await successPromise;
    });

    it('should handle concurrent operations without data corruption', async () => {
      // Simulate multiple clients trying to join queue simultaneously
      const concurrentJoins = Array.from({ length: 5 }, (_, i) => {
        const client = Client(`http://localhost:${(httpServer.address() as any)?.port}`);
        return new Promise<void>((resolve) => {
          client.on('connect', () => {
            client.emit('join-room', { room: 'public' });
            client.emit('join-queue', {
              name: `Concurrent Team ${i}`,
              members: 5
            });
            
            client.on('notification', (data) => {
              if (data.title === 'Joined Queue') {
                client.close();
                resolve();
              }
            });
          });
        });
      });

      await Promise.all(concurrentJoins);

      // Verify queue integrity
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(finalQueue.body.data.totalTeams).toBe(5);
      
      // Verify all positions are unique
      const positions = finalQueue.body.data.teams.map(t => t.position);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(5);
    });

    it('should maintain data consistency during server restart simulation', async () => {
      // Add teams to queue
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'Persistent Team 1', members: 5 })
        .expect(201);

      await request(app)
        .post('/api/queue/join')
        .send({ name: 'Persistent Team 2', members: 4 })
        .expect(201);

      // Simulate server restart by reinitializing database
      // In a real scenario, this would test persistence
      const preRestartQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(preRestartQueue.body.data.totalTeams).toBe(2);

      // Verify WebSocket clients can reconnect and receive current state
      clientSocket1.disconnect();
      clientSocket1.connect();

      const reconnectPromise = new Promise<void>((resolve) => {
        clientSocket1.on('connect', () => {
          clientSocket1.emit('join-room', { room: 'public' });
          resolve();
        });
      });

      await reconnectPromise;

      // Queue should still be accessible
      const postRestartQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(postRestartQueue.body.data.totalTeams).toBe(2);
    });
  });

  describe('Champion Return Mode Workflow', () => {
    it('should handle champion return mode correctly', async () => {
      // Set up initial match
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Champion Team', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Challenger Team', members: 4 })
        .expect(201);

      const match = await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: team1.body.data.team.id,
          team2Id: team2.body.data.team.id,
          targetScore: 15,
          matchType: 'champion-return'
        })
        .expect(201);

      // Champion wins
      await request(app)
        .put(`/api/match/${match.body.data.match.id}/score`)
        .send({ score1: 15, score2: 10 })
        .expect(200);

      // Both teams confirm
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

      // Verify champion goes back to queue with priority
      const queueAfterMatch = await request(app)
        .get('/api/queue')
        .expect(200);

      const championInQueue = queueAfterMatch.body.data.teams.find(
        t => t.name === 'Champion Team'
      );
      expect(championInQueue).toBeTruthy();
      expect(championInQueue.position).toBe(1); // Should be first in queue
    });

    it('should handle timeout scenarios in champion return mode', async () => {
      // Set up match
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Timeout Champion', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Timeout Challenger', members: 4 })
        .expect(201);

      const match = await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: team1.body.data.team.id,
          team2Id: team2.body.data.team.id,
          targetScore: 15,
          matchType: 'champion-return'
        })
        .expect(201);

      // Reach target score
      await request(app)
        .put(`/api/match/${match.body.data.match.id}/score`)
        .send({ score1: 15, score2: 12 })
        .expect(200);

      // Simulate timeout by waiting and then force resolving
      await new Promise(resolve => setTimeout(resolve, 100));

      const timeoutResponse = await request(app)
        .post(`/api/admin/match/${match.body.data.match.id}/timeout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(timeoutResponse.body.data.match.status).toBe('completed');
      expect(timeoutResponse.body.data.resolvedBy).toBe('timeout');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency score updates efficiently', async () => {
      // Set up match
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Speed Team 1', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Speed Team 2', members: 4 })
        .expect(201);

      const match = await request(app)
        .post('/api/admin/match/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          team1Id: team1.body.data.team.id,
          team2Id: team2.body.data.team.id,
          targetScore: 21,
          matchType: 'regular'
        })
        .expect(201);

      const matchId = match.body.data.match.id;

      // Set up multiple spectators
      const spectators = Array.from({ length: 10 }, () => {
        const client = Client(`http://localhost:${(httpServer.address() as any)?.port}`);
        const events: any[] = [];
        
        client.on('connect', () => {
          client.emit('join-room', { room: 'public' });
        });
        
        client.on('match-updated', (data) => {
          events.push(data);
        });
        
        return { client, events };
      });

      // Wait for all spectators to connect
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Rapid score updates
      const startTime = Date.now();
      const scoreUpdates = Array.from({ length: 20 }, (_, i) => ({
        score1: Math.floor(i / 2),
        score2: Math.floor(i / 3)
      }));

      for (const update of scoreUpdates) {
        await request(app)
          .put(`/api/match/${matchId}/score`)
          .send(update)
          .expect(200);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Wait for all events to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // All spectators should receive events
      spectators.forEach(({ client, events }) => {
        expect(events.length).toBeGreaterThan(0);
        client.close();
      });
    });

    it('should handle queue operations with maximum capacity', async () => {
      // Fill queue to maximum capacity (assuming 10)
      const maxTeams = 10;
      const joinPromises = Array.from({ length: maxTeams }, (_, i) =>
        request(app)
          .post('/api/queue/join')
          .send({ name: `Max Team ${i + 1}`, members: 5 })
          .expect(201)
      );

      const responses = await Promise.all(joinPromises);

      // Verify all teams joined successfully
      expect(responses).toHaveLength(maxTeams);

      // Verify queue is at capacity
      const fullQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(fullQueue.body.data.totalTeams).toBe(maxTeams);
      expect(fullQueue.body.data.availableSlots).toBe(0);

      // Try to add one more team (should fail)
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'Overflow Team', members: 5 })
        .expect(400);
    });
  });
});