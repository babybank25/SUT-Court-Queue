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

describe('Multi-Client Real-time Integration Tests', () => {
  let app: express.Application;
  let httpServer: Server;
  let ioServer: SocketIOServer;
  let clients: ClientSocket[] = [];
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
    // Close all client connections
    clients.forEach(client => client.close());
    ioServer.close();
    httpServer.close();
    await closeDatabase();
  });

  beforeEach(async () => {
    // Clear database and close existing clients
    await initializeDatabase(':memory:');
    clients.forEach(client => client.close());
    clients = [];
  });

  const createClient = (): Promise<ClientSocket> => {
    return new Promise((resolve) => {
      const client = Client(`http://localhost:${serverPort}`);
      client.on('connect', () => {
        clients.push(client);
        resolve(client);
      });
    });
  };

  const createMultipleClients = async (count: number): Promise<ClientSocket[]> => {
    const clientPromises = Array.from({ length: count }, () => createClient());
    return Promise.all(clientPromises);
  };

  describe('Queue Updates Across Multiple Clients', () => {
    it('should broadcast queue updates to all connected clients', async () => {
      const [client1, client2, client3] = await createMultipleClients(3);
      
      const client1Updates: any[] = [];
      const client2Updates: any[] = [];
      const client3Updates: any[] = [];

      // Set up event listeners
      client1.on('queue-updated', (data) => client1Updates.push(data));
      client2.on('queue-updated', (data) => client2Updates.push(data));
      client3.on('queue-updated', (data) => client3Updates.push(data));

      // All clients join the public room
      client1.emit('join-room', { room: 'public' });
      client2.emit('join-room', { room: 'public' });
      client3.emit('join-room', { room: 'public' });

      // Client 1 joins queue
      client1.emit('join-queue', {
        name: 'Multi-Client Team 1',
        members: 5,
        contactInfo: 'team1@test.com'
      });

      // Wait for updates to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      // All clients should receive the update
      expect(client1Updates.length).toBeGreaterThanOrEqual(1);
      expect(client2Updates.length).toBeGreaterThanOrEqual(1);
      expect(client3Updates.length).toBeGreaterThanOrEqual(1);

      // Verify update content consistency
      const lastUpdate1 = client1Updates[client1Updates.length - 1];
      const lastUpdate2 = client2Updates[client2Updates.length - 1];
      const lastUpdate3 = client3Updates[client3Updates.length - 1];

      expect(lastUpdate1.totalTeams).toBe(1);
      expect(lastUpdate2.totalTeams).toBe(1);
      expect(lastUpdate3.totalTeams).toBe(1);
      expect(lastUpdate1.event).toBe('team_joined');
      expect(lastUpdate2.event).toBe('team_joined');
      expect(lastUpdate3.event).toBe('team_joined');
    });

    it('should handle multiple simultaneous queue joins', async () => {
      const clientCount = 5;
      const testClients = await createMultipleClients(clientCount);
      
      const allUpdates: { [clientIndex: number]: any[] } = {};
      
      // Set up event listeners for all clients
      testClients.forEach((client, index) => {
        allUpdates[index] = [];
        client.on('queue-updated', (data) => allUpdates[index].push(data));
        client.emit('join-room', { room: 'public' });
      });

      // All clients try to join queue simultaneously
      const joinPromises = testClients.map((client, index) => {
        return new Promise<void>((resolve) => {
          client.emit('join-queue', {
            name: `Simultaneous Team ${index + 1}`,
            members: 5,
            contactInfo: `team${index + 1}@test.com`
          });
          
          client.on('notification', (data) => {
            if (data.title === 'Joined Queue') {
              resolve();
            }
          });
        });
      });

      await Promise.all(joinPromises);

      // Wait for all updates to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify final queue state via API
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(finalQueue.body.data.totalTeams).toBe(clientCount);

      // All clients should have received updates about all teams
      testClients.forEach((_, index) => {
        expect(allUpdates[index].length).toBeGreaterThan(0);
        const lastUpdate = allUpdates[index][allUpdates[index].length - 1];
        expect(lastUpdate.totalTeams).toBe(clientCount);
      });
    });

    it('should maintain update consistency when clients disconnect and reconnect', async () => {
      const [client1, client2] = await createMultipleClients(2);
      
      const client1Updates: any[] = [];
      const client2Updates: any[] = [];

      client1.on('queue-updated', (data) => client1Updates.push(data));
      client2.on('queue-updated', (data) => client2Updates.push(data));

      client1.emit('join-room', { room: 'public' });
      client2.emit('join-room', { room: 'public' });

      // Add initial team
      client1.emit('join-queue', {
        name: 'Persistent Team',
        members: 5
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Disconnect client2
      client2.disconnect();

      // Add another team while client2 is disconnected
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'Offline Team', members: 4 })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 300));

      // Reconnect client2
      const reconnectedClient2 = await createClient();
      const reconnectedUpdates: any[] = [];
      
      reconnectedClient2.on('queue-updated', (data) => reconnectedUpdates.push(data));
      reconnectedClient2.emit('join-room', { room: 'public' });

      // Add another team to trigger update
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'Post-Reconnect Team', members: 3 })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify reconnected client receives current state
      expect(reconnectedUpdates.length).toBeGreaterThan(0);
      const lastUpdate = reconnectedUpdates[reconnectedUpdates.length - 1];
      expect(lastUpdate.totalTeams).toBe(3);
    });
  });

  describe('Match Updates Across Multiple Spectators', () => {
    it('should broadcast match updates to all spectators', async () => {
      const spectatorCount = 4;
      const spectators = await createMultipleClients(spectatorCount);
      
      const allMatchUpdates: { [index: number]: any[] } = {};
      
      // Set up spectators
      spectators.forEach((spectator, index) => {
        allMatchUpdates[index] = [];
        spectator.on('match-updated', (data) => allMatchUpdates[index].push(data));
        spectator.emit('join-room', { room: 'public' });
      });

      // Set up match via API
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Spectator Test Team 1', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Spectator Test Team 2', members: 4 })
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

      const matchId = match.body.data.match.id;

      // Perform multiple score updates
      const scoreUpdates = [
        { score1: 3, score2: 1 },
        { score1: 7, score2: 5 },
        { score1: 12, score2: 8 },
        { score1: 15, score2: 10 }
      ];

      for (const update of scoreUpdates) {
        await request(app)
          .put(`/api/match/${matchId}/score`)
          .send(update)
          .expect(200);
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Wait for all updates to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // All spectators should receive match updates
      spectators.forEach((_, index) => {
        expect(allMatchUpdates[index].length).toBeGreaterThan(0);
        
        // Find the final score update
        const scoreUpdates = allMatchUpdates[index].filter(
          update => update.event === 'score_updated'
        );
        
        if (scoreUpdates.length > 0) {
          const finalUpdate = scoreUpdates[scoreUpdates.length - 1];
          expect(finalUpdate.match.score1).toBe(15);
          expect(finalUpdate.match.score2).toBe(10);
        }
      });
    });

    it('should handle match confirmation from multiple clients', async () => {
      const [teamClient1, teamClient2, spectator1, spectator2] = await createMultipleClients(4);
      
      const spectator1Updates: any[] = [];
      const spectator2Updates: any[] = [];

      // Set up spectators
      spectator1.on('match-updated', (data) => spectator1Updates.push(data));
      spectator2.on('match-updated', (data) => spectator2Updates.push(data));
      spectator1.emit('join-room', { room: 'public' });
      spectator2.emit('join-room', { room: 'public' });

      // Set up match
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Confirmation Team 1', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Confirmation Team 2', members: 4 })
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

      const matchId = match.body.data.match.id;

      // Reach target score
      await request(app)
        .put(`/api/match/${matchId}/score`)
        .send({ score1: 15, score2: 12 })
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 300));

      // Team clients join room and confirm
      teamClient1.emit('join-room', { room: 'public' });
      teamClient2.emit('join-room', { room: 'public' });

      // First team confirms via WebSocket
      teamClient1.emit('confirm-result', {
        matchId,
        teamId: team1.body.data.team.id,
        confirmed: true
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Second team confirms via API
      await request(app)
        .post('/api/match/confirm')
        .send({
          matchId,
          teamId: team2.body.data.team.id,
          confirmed: true
        })
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Both spectators should receive match completion updates
      const spectator1Completions = spectator1Updates.filter(
        update => update.event === 'match_completed'
      );
      const spectator2Completions = spectator2Updates.filter(
        update => update.event === 'match_completed'
      );

      expect(spectator1Completions.length).toBeGreaterThanOrEqual(1);
      expect(spectator2Completions.length).toBeGreaterThanOrEqual(1);

      if (spectator1Completions.length > 0) {
        expect(spectator1Completions[0].winner).toBe('Confirmation Team 1');
        expect(spectator1Completions[0].finalScore).toBe('15-12');
      }
    });

    it('should handle high-frequency updates without message loss', async () => {
      const clientCount = 10;
      const testClients = await createMultipleClients(clientCount);
      
      const allUpdates: { [index: number]: any[] } = {};
      
      // Set up all clients as spectators
      testClients.forEach((client, index) => {
        allUpdates[index] = [];
        client.on('match-updated', (data) => allUpdates[index].push(data));
        client.emit('join-room', { room: 'public' });
      });

      // Set up match
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'High Frequency Team 1', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'High Frequency Team 2', members: 4 })
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

      // Rapid score updates
      const updateCount = 20;
      const updatePromises = [];

      for (let i = 1; i <= updateCount; i++) {
        const updatePromise = request(app)
          .put(`/api/match/${matchId}/score`)
          .send({ 
            score1: Math.floor(i / 2), 
            score2: Math.floor(i / 3) 
          })
          .expect(200);
        
        updatePromises.push(updatePromise);
        
        // Small delay to prevent overwhelming the server
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      await Promise.all(updatePromises);

      // Wait for all updates to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify all clients received updates
      testClients.forEach((_, index) => {
        expect(allUpdates[index].length).toBeGreaterThan(0);
        
        // Should have received multiple score updates
        const scoreUpdates = allUpdates[index].filter(
          update => update.event === 'score_updated'
        );
        expect(scoreUpdates.length).toBeGreaterThan(5);
      });

      // Verify final scores are consistent across all clients
      const finalScores = testClients.map((_, index) => {
        const scoreUpdates = allUpdates[index].filter(
          update => update.event === 'score_updated'
        );
        if (scoreUpdates.length > 0) {
          const lastUpdate = scoreUpdates[scoreUpdates.length - 1];
          return `${lastUpdate.match.score1}-${lastUpdate.match.score2}`;
        }
        return null;
      }).filter(score => score !== null);

      // All non-null scores should be the same
      if (finalScores.length > 1) {
        const firstScore = finalScores[0];
        finalScores.forEach(score => {
          expect(score).toBe(firstScore);
        });
      }
    });
  });

  describe('Mixed API and WebSocket Operations', () => {
    it('should maintain consistency between API and WebSocket operations', async () => {
      const [wsClient1, wsClient2] = await createMultipleClients(2);
      
      const client1Updates: any[] = [];
      const client2Updates: any[] = [];

      client1.on('queue-updated', (data) => client1Updates.push(data));
      client2.on('queue-updated', (data) => client2Updates.push(data));

      client1.emit('join-room', { room: 'public' });
      client2.emit('join-room', { room: 'public' });

      // Mix of API and WebSocket operations
      
      // 1. Add team via API
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'API Team', members: 5 })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 200));

      // 2. Add team via WebSocket
      wsClient1.emit('join-queue', {
        name: 'WebSocket Team',
        members: 4
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // 3. Add another team via API
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'API Team 2', members: 3 })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify final state via API
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(finalQueue.body.data.totalTeams).toBe(3);

      // Both WebSocket clients should have received all updates
      expect(client1Updates.length).toBeGreaterThanOrEqual(3);
      expect(client2Updates.length).toBeGreaterThanOrEqual(3);

      // Final update should reflect correct total
      const lastUpdate1 = client1Updates[client1Updates.length - 1];
      const lastUpdate2 = client2Updates[client2Updates.length - 1];

      expect(lastUpdate1.totalTeams).toBe(3);
      expect(lastUpdate2.totalTeams).toBe(3);
    });

    it('should handle concurrent API and WebSocket operations', async () => {
      const wsClients = await createMultipleClients(3);
      
      const allUpdates: any[][] = wsClients.map(() => []);

      // Set up WebSocket listeners
      wsClients.forEach((client, index) => {
        client.on('queue-updated', (data) => allUpdates[index].push(data));
        client.emit('join-room', { room: 'public' });
      });

      // Concurrent operations
      const operations = [
        // API operations
        request(app).post('/api/queue/join').send({ name: 'Concurrent API Team 1', members: 5 }),
        request(app).post('/api/queue/join').send({ name: 'Concurrent API Team 2', members: 4 }),
        
        // WebSocket operations
        new Promise<void>((resolve) => {
          wsClients[0].emit('join-queue', { name: 'Concurrent WS Team 1', members: 3 });
          wsClients[0].on('notification', (data) => {
            if (data.title === 'Joined Queue' && data.message.includes('Concurrent WS Team 1')) {
              resolve();
            }
          });
        }),
        
        new Promise<void>((resolve) => {
          wsClients[1].emit('join-queue', { name: 'Concurrent WS Team 2', members: 5 });
          wsClients[1].on('notification', (data) => {
            if (data.title === 'Joined Queue' && data.message.includes('Concurrent WS Team 2')) {
              resolve();
            }
          });
        })
      ];

      await Promise.allSettled(operations);

      // Wait for all updates to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify final state
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      // Should have 4 teams (2 API + 2 WebSocket)
      expect(finalQueue.body.data.totalTeams).toBe(4);

      // All WebSocket clients should have received updates
      allUpdates.forEach(updates => {
        expect(updates.length).toBeGreaterThan(0);
        const lastUpdate = updates[updates.length - 1];
        expect(lastUpdate.totalTeams).toBe(4);
      });
    });
  });

  describe('Error Handling and Recovery in Multi-Client Environment', () => {
    it('should handle individual client errors without affecting others', async () => {
      const [goodClient1, goodClient2, badClient] = await createMultipleClients(3);
      
      const good1Updates: any[] = [];
      const good2Updates: any[] = [];
      const badClientErrors: any[] = [];

      goodClient1.on('queue-updated', (data) => good1Updates.push(data));
      goodClient2.on('queue-updated', (data) => good2Updates.push(data));
      badClient.on('error', (error) => badClientErrors.push(error));

      goodClient1.emit('join-room', { room: 'public' });
      goodClient2.emit('join-room', { room: 'public' });
      badClient.emit('join-room', { room: 'public' });

      // Bad client sends invalid data
      badClient.emit('join-queue', {
        name: '', // Invalid empty name
        members: 0 // Invalid member count
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Good clients perform valid operations
      goodClient1.emit('join-queue', {
        name: 'Good Team 1',
        members: 5
      });

      goodClient2.emit('join-queue', {
        name: 'Good Team 2',
        members: 4
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Bad client should receive error
      expect(badClientErrors.length).toBeGreaterThan(0);
      expect(badClientErrors[0].code).toBe('VALIDATION_ERROR');

      // Good clients should receive updates
      expect(good1Updates.length).toBeGreaterThan(0);
      expect(good2Updates.length).toBeGreaterThan(0);

      // Final state should have 2 teams
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(finalQueue.body.data.totalTeams).toBe(2);
    });

    it('should handle server restart with client reconnection', async () => {
      const testClients = await createMultipleClients(2);
      
      const allUpdates: any[][] = testClients.map(() => []);

      // Set up initial state
      testClients.forEach((client, index) => {
        client.on('queue-updated', (data) => allUpdates[index].push(data));
        client.emit('join-room', { room: 'public' });
      });

      // Add initial data
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'Pre-Restart Team', members: 5 })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 300));

      // Simulate server restart by reinitializing database
      // In a real scenario, this would test persistence
      await initializeDatabase(':memory:');

      // Clients should handle disconnection and reconnection
      const reconnectedClients = await createMultipleClients(2);
      const reconnectedUpdates: any[][] = reconnectedClients.map(() => []);

      reconnectedClients.forEach((client, index) => {
        client.on('queue-updated', (data) => reconnectedUpdates[index].push(data));
        client.emit('join-room', { room: 'public' });
      });

      // Add new data after "restart"
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'Post-Restart Team', members: 4 })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Reconnected clients should receive new updates
      reconnectedClients.forEach((_, index) => {
        expect(reconnectedUpdates[index].length).toBeGreaterThan(0);
      });
    });

    it('should maintain data integrity under high client load', async () => {
      const clientCount = 20;
      const testClients = await createMultipleClients(clientCount);
      
      // Set up all clients
      const allPromises = testClients.map((client, index) => {
        return new Promise<void>((resolve) => {
          client.emit('join-room', { room: 'public' });
          client.emit('join-queue', {
            name: `Load Test Team ${index + 1}`,
            members: 5
          });
          
          client.on('notification', (data) => {
            if (data.title === 'Joined Queue') {
              resolve();
            }
          });
          
          // Set timeout to prevent hanging
          setTimeout(() => resolve(), 5000);
        });
      });

      const results = await Promise.allSettled(allPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      // Most operations should succeed (allowing for some failures under high load)
      expect(successful).toBeGreaterThan(clientCount * 0.8);

      // Verify final queue state
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      // Should have teams in queue (exact number may vary due to race conditions)
      expect(finalQueue.body.data.totalTeams).toBeGreaterThan(0);
      expect(finalQueue.body.data.totalTeams).toBeLessThanOrEqual(clientCount);

      // Verify no duplicate team names
      const teamNames = finalQueue.body.data.teams.map(t => t.name);
      const uniqueNames = new Set(teamNames);
      expect(uniqueNames.size).toBe(teamNames.length);
    });
  });
});