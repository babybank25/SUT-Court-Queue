import request from 'supertest';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import cors from 'cors';
import { initializeDatabase, closeDatabase } from '../../database';
import queueRouter from '../../routes/queue';
import matchRouter from '../../routes/match';
import { setSocketInstance } from '../../services/socketService';
import {
  handleJoinQueue,
  handleConfirmResult,
  handleJoinRoom,
} from '../../services/socketHandlers';

describe('Queue Workflow Integration Tests', () => {
  let app: express.Application;
  let httpServer: Server;
  let ioServer: SocketIOServer;
  let clientSocket: ClientSocket;
  let serverSocket: any;

  beforeAll(async () => {
    // Initialize test database
    await initializeDatabase(':memory:');

    // Set up Express app
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/queue', queueRouter);
    app.use('/api/match', matchRouter);

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
        
        // Set up client socket
        clientSocket = Client(`http://localhost:${port}`);
        
        // Set up server socket handlers
        ioServer.on('connection', (socket) => {
          serverSocket = socket;
          socket.on('join-room', (data) => handleJoinRoom(socket, data));
          socket.on('join-queue', (data) => handleJoinQueue(socket, data));
          socket.on('confirm-result', (data) => handleConfirmResult(socket, data));
        });
        
        clientSocket.on('connect', resolve);
      });
    });
  });

  afterAll(async () => {
    clientSocket.close();
    ioServer.close();
    httpServer.close();
    await closeDatabase();
  });

  beforeEach(async () => {
    // Clear database between tests
    await initializeDatabase(':memory:');
  });

  describe('Complete Queue Join Workflow', () => {
    it('should handle complete team joining workflow via API', async () => {
      // Step 1: Get initial queue state
      const initialQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(initialQueue.body.data.totalTeams).toBe(0);
      expect(initialQueue.body.data.availableSlots).toBe(10);

      // Step 2: Join queue via API
      const joinResponse = await request(app)
        .post('/api/queue/join')
        .send({
          name: 'Test Team Alpha',
          members: 5,
          contactInfo: 'alpha@test.com'
        })
        .expect(201);

      expect(joinResponse.body.success).toBe(true);
      expect(joinResponse.body.data.team.name).toBe('Test Team Alpha');
      expect(joinResponse.body.data.position).toBe(1);

      // Step 3: Verify queue state updated
      const updatedQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(updatedQueue.body.data.totalTeams).toBe(1);
      expect(updatedQueue.body.data.availableSlots).toBe(9);
      expect(updatedQueue.body.data.teams[0].name).toBe('Test Team Alpha');

      // Step 4: Check team position
      const teamId = joinResponse.body.data.team.id;
      const positionResponse = await request(app)
        .get(`/api/queue/position/${teamId}`)
        .expect(200);

      expect(positionResponse.body.data.team.position).toBe(1);
      expect(positionResponse.body.data.teamsAhead).toBe(0);
    });

    it('should handle complete team joining workflow via WebSocket', (done) => {
      let notificationReceived = false;
      let queueUpdateReceived = false;

      // Set up event listeners
      clientSocket.on('notification', (data) => {
        expect(data.type).toBe('success');
        expect(data.title).toBe('Joined Queue');
        expect(data.message).toContain('Test Team Beta');
        notificationReceived = true;
        
        if (notificationReceived && queueUpdateReceived) {
          done();
        }
      });

      clientSocket.on('queue-updated', (data) => {
        expect(data.totalTeams).toBe(1);
        expect(data.availableSlots).toBe(9);
        expect(data.event).toBe('team_joined');
        queueUpdateReceived = true;
        
        if (notificationReceived && queueUpdateReceived) {
          done();
        }
      });

      // Join room first
      clientSocket.emit('join-room', { room: 'public' });

      // Join queue via WebSocket
      clientSocket.emit('join-queue', {
        name: 'Test Team Beta',
        members: 4,
        contactInfo: 'beta@test.com'
      });
    });

    it('should handle multiple teams joining queue', async () => {
      const teams = [
        { name: 'Team Alpha', members: 5, contactInfo: 'alpha@test.com' },
        { name: 'Team Beta', members: 4, contactInfo: 'beta@test.com' },
        { name: 'Team Gamma', members: 3, contactInfo: 'gamma@test.com' },
      ];

      // Join multiple teams
      const joinPromises = teams.map(team =>
        request(app)
          .post('/api/queue/join')
          .send(team)
          .expect(201)
      );

      const responses = await Promise.all(joinPromises);

      // Verify positions
      expect(responses[0].body.data.position).toBe(1);
      expect(responses[1].body.data.position).toBe(2);
      expect(responses[2].body.data.position).toBe(3);

      // Verify final queue state
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(finalQueue.body.data.totalTeams).toBe(3);
      expect(finalQueue.body.data.availableSlots).toBe(7);
      expect(finalQueue.body.data.teams).toHaveLength(3);
    });

    it('should handle team leaving queue and position updates', async () => {
      // Add three teams
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Team 1', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Team 2', members: 4 })
        .expect(201);

      const team3 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Team 3', members: 3 })
        .expect(201);

      // Remove middle team
      await request(app)
        .delete(`/api/queue/leave/${team2.body.data.team.id}`)
        .expect(200);

      // Verify positions updated
      const team1Position = await request(app)
        .get(`/api/queue/position/${team1.body.data.team.id}`)
        .expect(200);

      const team3Position = await request(app)
        .get(`/api/queue/position/${team3.body.data.team.id}`)
        .expect(200);

      expect(team1Position.body.data.team.position).toBe(1);
      expect(team3Position.body.data.team.position).toBe(2);

      // Verify queue state
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(finalQueue.body.data.totalTeams).toBe(2);
      expect(finalQueue.body.data.teams.map(t => t.name)).toEqual(['Team 1', 'Team 3']);
    });
  });

  describe('Queue Validation and Error Handling', () => {
    it('should prevent duplicate team names', async () => {
      // Add first team
      await request(app)
        .post('/api/queue/join')
        .send({ name: 'Duplicate Team', members: 5 })
        .expect(201);

      // Try to add team with same name
      const duplicateResponse = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Duplicate Team', members: 4 })
        .expect(400);

      expect(duplicateResponse.body.error.code).toBe('TEAM_NAME_EXISTS');
    });

    it('should prevent joining when queue is full', async () => {
      // Fill queue to capacity (assuming max size is 10)
      const joinPromises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/queue/join')
          .send({ name: `Team ${i + 1}`, members: 5 })
          .expect(201)
      );

      await Promise.all(joinPromises);

      // Try to add one more team
      const overflowResponse = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Overflow Team', members: 5 })
        .expect(400);

      expect(overflowResponse.body.error.code).toBe('QUEUE_FULL');
    });

    it('should validate input data', async () => {
      const invalidInputs = [
        { name: '', members: 5 }, // Empty name
        { name: 'A', members: 5 }, // Too short name
        { name: 'Valid Team', members: 0 }, // Invalid member count
        { name: 'Valid Team', members: 11 }, // Too many members
      ];

      for (const input of invalidInputs) {
        await request(app)
          .post('/api/queue/join')
          .send(input)
          .expect(400);
      }
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should broadcast queue updates to all connected clients', (done) => {
      let client1Updates = 0;
      let client2Updates = 0;

      // Create second client
      const client2 = Client(`http://localhost:${(httpServer.address() as any)?.port}`);

      const checkCompletion = () => {
        if (client1Updates >= 1 && client2Updates >= 1) {
          client2.close();
          done();
        }
      };

      clientSocket.on('queue-updated', (data) => {
        client1Updates++;
        expect(data.event).toBe('team_joined');
        checkCompletion();
      });

      client2.on('connect', () => {
        client2.emit('join-room', { room: 'public' });
        
        client2.on('queue-updated', (data) => {
          client2Updates++;
          expect(data.event).toBe('team_joined');
          checkCompletion();
        });

        // Join queue after both clients are set up
        clientSocket.emit('join-room', { room: 'public' });
        clientSocket.emit('join-queue', {
          name: 'Broadcast Test Team',
          members: 5
        });
      });
    });

    it('should handle WebSocket errors gracefully', (done) => {
      clientSocket.on('error', (error) => {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.message).toBe('Invalid queue join data');
        done();
      });

      // Send invalid data
      clientSocket.emit('join-queue', { name: '', members: 0 });
    });
  });

  describe('API and WebSocket Consistency', () => {
    it('should maintain consistency between API and WebSocket operations', async () => {
      // Add team via API
      const apiResponse = await request(app)
        .post('/api/queue/join')
        .send({ name: 'API Team', members: 5 })
        .expect(201);

      // Get queue state via API
      const apiQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(apiQueue.body.data.totalTeams).toBe(1);

      // Add team via WebSocket and verify API sees the change
      await new Promise<void>((resolve) => {
        clientSocket.emit('join-room', { room: 'public' });
        clientSocket.emit('join-queue', {
          name: 'WebSocket Team',
          members: 4
        });

        clientSocket.on('notification', async (data) => {
          if (data.title === 'Joined Queue') {
            // Verify via API
            const updatedQueue = await request(app)
              .get('/api/queue')
              .expect(200);

            expect(updatedQueue.body.data.totalTeams).toBe(2);
            expect(updatedQueue.body.data.teams.map(t => t.name))
              .toContain('WebSocket Team');
            
            resolve();
          }
        });
      });
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle database connection issues gracefully', async () => {
      // This would require mocking database failures
      // For now, we'll test that the API returns appropriate errors
      
      const response = await request(app)
        .get('/api/queue/position/non-existent-id')
        .expect(404);

      expect(response.body.error.code).toBe('TEAM_NOT_FOUND');
    });

    it('should handle concurrent queue operations', async () => {
      // Simulate concurrent joins
      const concurrentJoins = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/queue/join')
          .send({ name: `Concurrent Team ${i}`, members: 5 })
      );

      const results = await Promise.allSettled(concurrentJoins);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBe(5);

      // Verify all teams have unique positions
      const positions = successful.map(r => 
        (r as PromiseFulfilledResult<any>).value.body.data.position
      );
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(5);
    });
  });
});