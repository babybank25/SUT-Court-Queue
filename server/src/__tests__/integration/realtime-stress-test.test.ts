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

describe('Real-time Stress and Performance Integration Tests', () => {
  let app: express.Application;
  let httpServer: Server;
  let ioServer: SocketIOServer;
  let adminToken: string;
  let serverPort: number;
  let clients: ClientSocket[] = [];

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
      cors: { origin: "*", methods: ["GET", "POST"] },
      transports: ['websocket', 'polling']
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
    return new Promise((resolve, reject) => {
      const client = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket']
      });
      
      const timeout = setTimeout(() => {
        reject(new Error('Client connection timeout'));
      }, 5000);
      
      client.on('connect', () => {
        clearTimeout(timeout);
        clients.push(client);
        resolve(client);
      });
      
      client.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  };

  describe('High-Load Real-time Scenarios', () => {
    it('should handle 50 concurrent spectators during active match', async () => {
      const spectatorCount = 50;
      const spectators: ClientSocket[] = [];
      const allUpdates: { [index: number]: any[] } = {};

      // Create spectators
      const spectatorPromises = Array.from({ length: spectatorCount }, async (_, index) => {
        try {
          const client = await createClient();
          spectators.push(client);
          allUpdates[index] = [];
          
          client.on('match-updated', (data) => {
            allUpdates[index].push({ type: 'match', data, timestamp: Date.now() });
          });
          
          client.on('queue-updated', (data) => {
            allUpdates[index].push({ type: 'queue', data, timestamp: Date.now() });
          });
          
          client.emit('join-room', { room: 'public' });
          return client;
        } catch (error) {
          console.warn(`Failed to create spectator ${index}:`, error);
          return null;
        }
      });

      const connectedSpectators = (await Promise.allSettled(spectatorPromises))
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<ClientSocket>).value);

      expect(connectedSpectators.length).toBeGreaterThan(spectatorCount * 0.8); // At least 80% should connect

      // Set up match
      const team1 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Stress Team 1', members: 5 })
        .expect(201);

      const team2 = await request(app)
        .post('/api/queue/join')
        .send({ name: 'Stress Team 2', members: 4 })
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
      const startTime = Date.now();
      const scoreUpdates = Array.from({ length: 30 }, (_, i) => ({
        score1: Math.floor(i * 0.7),
        score2: Math.floor(i * 0.5)
      }));

      for (const update of scoreUpdates) {
        await request(app)
          .put(`/api/match/${matchId}/score`)
          .send(update)
          .expect(200);
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Wait for all updates to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify performance
      expect(totalDuration).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify all spectators received updates
      let totalUpdatesReceived = 0;
      let spectatorsWithUpdates = 0;

      connectedSpectators.forEach((_, index) => {
        const updates = allUpdates[index] || [];
        totalUpdatesReceived += updates.length;
        
        if (updates.length > 0) {
          spectatorsWithUpdates++;
        }
      });

      // At least 90% of spectators should receive updates
      expect(spectatorsWithUpdates).toBeGreaterThan(connectedSpectators.length * 0.9);
      
      // Average updates per spectator should be reasonable
      const avgUpdatesPerSpectator = totalUpdatesReceived / connectedSpectators.length;
      expect(avgUpdatesPerSpectator).toBeGreaterThan(5);

      // Clean up
      connectedSpectators.forEach(client => client.close());
    });

    it('should handle rapid queue operations with multiple clients', async () => {
      const clientCount = 20;
      const testClients: ClientSocket[] = [];
      const operationResults: { [index: number]: any[] } = {};

      // Create clients
      for (let i = 0; i < clientCount; i++) {
        try {
          const client = await createClient();
          testClients.push(client);
          operationResults[i] = [];
          
          client.on('notification', (data) => {
            operationResults[i].push({ type: 'notification', data, timestamp: Date.now() });
          });
          
          client.on('error', (error) => {
            operationResults[i].push({ type: 'error', error, timestamp: Date.now() });
          });
          
          client.emit('join-room', { room: 'public' });
        } catch (error) {
          console.warn(`Failed to create client ${i}:`, error);
        }
      }

      expect(testClients.length).toBeGreaterThan(clientCount * 0.8);

      // Rapid queue operations
      const startTime = Date.now();
      const operations = testClients.map((client, index) => {
        return new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 5000); // Timeout after 5 seconds
          
          client.emit('join-queue', {
            name: `Rapid Team ${index + 1}`,
            members: Math.floor(Math.random() * 3) + 3,
            contactInfo: `team${index + 1}@rapid.test`
          });
          
          client.on('notification', (data) => {
            if (data.title === 'Joined Queue' && data.message.includes(`Rapid Team ${index + 1}`)) {
              clearTimeout(timeout);
              resolve();
            }
          });
          
          client.on('error', () => {
            clearTimeout(timeout);
            resolve(); // Resolve even on error to not block Promise.all
          });
        });
      });

      const results = await Promise.allSettled(operations);
      const endTime = Date.now();
      const operationDuration = endTime - startTime;

      // Performance check
      expect(operationDuration).toBeLessThan(15000); // Should complete within 15 seconds

      // Check success rate
      const successfulOperations = results.filter(result => result.status === 'fulfilled').length;
      expect(successfulOperations).toBeGreaterThan(testClients.length * 0.7); // At least 70% success

      // Verify final queue state
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(finalQueue.body.data.totalTeams).toBeGreaterThan(0);
      expect(finalQueue.body.data.totalTeams).toBeLessThanOrEqual(testClients.length);

      // Verify no duplicate positions
      const positions = finalQueue.body.data.teams.map(t => t.position);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(positions.length);

      // Clean up
      testClients.forEach(client => client.close());
    });

    it('should maintain data consistency under concurrent API and WebSocket operations', async () => {
      const wsClientCount = 10;
      const apiOperationCount = 10;
      const wsClients: ClientSocket[] = [];
      const allUpdates: any[] = [];

      // Create WebSocket clients
      for (let i = 0; i < wsClientCount; i++) {
        try {
          const client = await createClient();
          wsClients.push(client);
          
          client.on('queue-updated', (data) => {
            allUpdates.push({ 
              source: 'websocket', 
              clientId: i, 
              data, 
              timestamp: Date.now() 
            });
          });
          
          client.emit('join-room', { room: 'public' });
        } catch (error) {
          console.warn(`Failed to create WebSocket client ${i}:`, error);
        }
      }

      // Concurrent operations: mix of API calls and WebSocket operations
      const concurrentOperations = [];

      // API operations
      for (let i = 0; i < apiOperationCount; i++) {
        concurrentOperations.push(
          request(app)
            .post('/api/queue/join')
            .send({ 
              name: `API Team ${i + 1}`, 
              members: Math.floor(Math.random() * 3) + 3 
            })
            .then(response => ({
              type: 'api',
              success: response.status === 201,
              teamName: `API Team ${i + 1}`
            }))
            .catch(() => ({ type: 'api', success: false, teamName: `API Team ${i + 1}` }))
        );
      }

      // WebSocket operations
      wsClients.forEach((client, index) => {
        if (index < wsClientCount / 2) { // Only half the clients perform operations
          concurrentOperations.push(
            new Promise<any>((resolve) => {
              const teamName = `WS Team ${index + 1}`;
              const timeout = setTimeout(() => {
                resolve({ type: 'websocket', success: false, teamName });
              }, 5000);
              
              client.emit('join-queue', {
                name: teamName,
                members: Math.floor(Math.random() * 3) + 3
              });
              
              client.on('notification', (data) => {
                if (data.title === 'Joined Queue' && data.message.includes(teamName)) {
                  clearTimeout(timeout);
                  resolve({ type: 'websocket', success: true, teamName });
                }
              });
              
              client.on('error', () => {
                clearTimeout(timeout);
                resolve({ type: 'websocket', success: false, teamName });
              });
            })
          );
        }
      });

      // Execute all operations concurrently
      const startTime = Date.now();
      const operationResults = await Promise.allSettled(concurrentOperations);
      const endTime = Date.now();

      // Performance check
      expect(endTime - startTime).toBeLessThan(20000); // Should complete within 20 seconds

      // Analyze results
      const successfulResults = operationResults
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any>).value)
        .filter(value => value.success);

      expect(successfulResults.length).toBeGreaterThan(concurrentOperations.length * 0.6);

      // Wait for all updates to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify final consistency
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      // Check data integrity
      expect(finalQueue.body.data.totalTeams).toBeGreaterThan(0);
      
      // Verify all team names are unique
      const teamNames = finalQueue.body.data.teams.map(t => t.name);
      const uniqueNames = new Set(teamNames);
      expect(uniqueNames.size).toBe(teamNames.length);

      // Verify positions are sequential
      const positions = finalQueue.body.data.teams.map(t => t.position).sort((a, b) => a - b);
      for (let i = 0; i < positions.length; i++) {
        expect(positions[i]).toBe(i + 1);
      }

      // Verify WebSocket updates were consistent
      const queueUpdates = allUpdates.filter(update => update.data.event);
      expect(queueUpdates.length).toBeGreaterThan(0);

      // Clean up
      wsClients.forEach(client => client.close());
    });

    it('should handle connection drops and reconnections during active operations', async () => {
      const clientCount = 15;
      const clients: ClientSocket[] = [];
      const reconnectionResults: any[] = [];

      // Create initial clients
      for (let i = 0; i < clientCount; i++) {
        try {
          const client = await createClient();
          clients.push(client);
          client.emit('join-room', { room: 'public' });
        } catch (error) {
          console.warn(`Failed to create client ${i}:`, error);
        }
      }

      // Add some teams to queue
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/queue/join')
          .send({ name: `Reconnect Team ${i + 1}`, members: 5 })
          .expect(201);
      }

      // Start a match
      const queueState = await request(app).get('/api/queue').expect(200);
      const teams = queueState.body.data.teams;

      if (teams.length >= 2) {
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

        // Simulate connection drops during active match
        const droppedClients = clients.slice(0, Math.floor(clientCount / 2));
        const stableClients = clients.slice(Math.floor(clientCount / 2));

        // Drop connections
        droppedClients.forEach(client => client.disconnect());

        // Continue match operations with stable clients
        const matchId = match.body.data.match.id;
        
        // Update scores while some clients are disconnected
        for (let score = 1; score <= 10; score++) {
          await request(app)
            .put(`/api/match/${matchId}/score`)
            .send({ score1: score * 2, score2: score })
            .expect(200);
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Reconnect dropped clients
        const reconnectionPromises = droppedClients.map(async (client, index) => {
          try {
            client.connect();
            
            return new Promise<boolean>((resolve) => {
              const timeout = setTimeout(() => resolve(false), 3000);
              
              client.on('connect', () => {
                clearTimeout(timeout);
                client.emit('join-room', { room: 'public' });
                reconnectionResults.push({ clientIndex: index, reconnected: true });
                resolve(true);
              });
              
              client.on('connect_error', () => {
                clearTimeout(timeout);
                reconnectionResults.push({ clientIndex: index, reconnected: false });
                resolve(false);
              });
            });
          } catch (error) {
            reconnectionResults.push({ clientIndex: index, reconnected: false, error });
            return false;
          }
        });

        const reconnectionResults_resolved = await Promise.allSettled(reconnectionPromises);
        const successfulReconnections = reconnectionResults_resolved
          .filter(result => result.status === 'fulfilled' && result.value === true)
          .length;

        // At least 70% should reconnect successfully
        expect(successfulReconnections).toBeGreaterThan(droppedClients.length * 0.7);

        // Continue match and verify all clients receive updates
        await request(app)
          .put(`/api/match/${matchId}/score`)
          .send({ score1: 21, score2: 18 })
          .expect(200);

        // Wait for updates to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify match state is consistent
        const finalMatch = await request(app)
          .get(`/api/match/${matchId}`)
          .expect(200);

        expect(finalMatch.body.data.match.score1).toBe(21);
        expect(finalMatch.body.data.match.score2).toBe(18);
      }

      // Clean up
      clients.forEach(client => client.close());
    });

    it('should handle memory and resource management under sustained load', async () => {
      const testDuration = 10000; // 10 seconds
      const operationInterval = 100; // Every 100ms
      const maxConcurrentClients = 25;
      
      let activeClients: ClientSocket[] = [];
      let totalOperations = 0;
      let successfulOperations = 0;
      let errors: any[] = [];

      const startTime = Date.now();
      
      const loadTest = async () => {
        while (Date.now() - startTime < testDuration) {
          try {
            // Manage client pool
            if (activeClients.length < maxConcurrentClients) {
              const client = await createClient();
              activeClients.push(client);
              client.emit('join-room', { room: 'public' });
              
              // Set up error handling
              client.on('error', (error) => {
                errors.push({ type: 'client_error', error, timestamp: Date.now() });
              });
            }

            // Perform random operations
            const operation = Math.random();
            totalOperations++;

            if (operation < 0.3 && activeClients.length > 0) {
              // Join queue via WebSocket
              const client = activeClients[Math.floor(Math.random() * activeClients.length)];
              client.emit('join-queue', {
                name: `Load Test Team ${totalOperations}`,
                members: Math.floor(Math.random() * 3) + 3
              });
              successfulOperations++;
              
            } else if (operation < 0.6) {
              // Join queue via API
              try {
                await request(app)
                  .post('/api/queue/join')
                  .send({ 
                    name: `API Load Team ${totalOperations}`, 
                    members: Math.floor(Math.random() * 3) + 3 
                  });
                successfulOperations++;
              } catch (error) {
                errors.push({ type: 'api_error', error, timestamp: Date.now() });
              }
              
            } else if (operation < 0.8) {
              // Get queue state
              try {
                await request(app).get('/api/queue');
                successfulOperations++;
              } catch (error) {
                errors.push({ type: 'api_error', error, timestamp: Date.now() });
              }
              
            } else {
              // Disconnect and reconnect a random client
              if (activeClients.length > 5) {
                const clientIndex = Math.floor(Math.random() * activeClients.length);
                const client = activeClients[clientIndex];
                
                client.disconnect();
                activeClients.splice(clientIndex, 1);
                
                // Reconnect after a short delay
                setTimeout(async () => {
                  try {
                    const newClient = await createClient();
                    activeClients.push(newClient);
                    newClient.emit('join-room', { room: 'public' });
                  } catch (error) {
                    errors.push({ type: 'reconnection_error', error, timestamp: Date.now() });
                  }
                }, 500);
              }
              successfulOperations++;
            }

            await new Promise(resolve => setTimeout(resolve, operationInterval));
            
          } catch (error) {
            errors.push({ type: 'general_error', error, timestamp: Date.now() });
          }
        }
      };

      await loadTest();

      // Analyze results
      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      const operationsPerSecond = totalOperations / (actualDuration / 1000);
      const successRate = successfulOperations / totalOperations;
      const errorRate = errors.length / totalOperations;

      // Performance assertions
      expect(operationsPerSecond).toBeGreaterThan(5); // At least 5 ops/sec
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
      expect(errorRate).toBeLessThan(0.2); // Less than 20% error rate

      // Verify system is still responsive
      const finalQueue = await request(app)
        .get('/api/queue')
        .expect(200);

      expect(finalQueue.body.success).toBe(true);

      // Clean up
      activeClients.forEach(client => client.close());

      // Log performance metrics
      console.log(`Load test completed:
        Duration: ${actualDuration}ms
        Total operations: ${totalOperations}
        Successful operations: ${successfulOperations}
        Operations/second: ${operationsPerSecond.toFixed(2)}
        Success rate: ${(successRate * 100).toFixed(2)}%
        Error rate: ${(errorRate * 100).toFixed(2)}%
        Final queue size: ${finalQueue.body.data.totalTeams}
      `);
    });
  });

  describe('Edge Cases and Error Recovery', () => {
    it('should handle malformed WebSocket messages gracefully', async () => {
      const client = await createClient();
      const errors: any[] = [];
      
      client.on('error', (error) => {
        errors.push(error);
      });
      
      client.emit('join-room', { room: 'public' });

      // Send malformed messages
      const malformedMessages = [
        { event: 'join-queue', data: null },
        { event: 'join-queue', data: { name: null, members: 'invalid' } },
        { event: 'join-queue', data: { name: '', members: -1 } },
        { event: 'invalid-event', data: { test: true } },
        null,
        undefined,
        'invalid-string-message'
      ];

      for (const message of malformedMessages) {
        try {
          if (message && typeof message === 'object' && message.event) {
            client.emit(message.event, message.data);
          } else {
            // @ts-ignore - intentionally sending invalid data
            client.emit('join-queue', message);
          }
        } catch (error) {
          // Expected for some malformed messages
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify client is still connected and can perform valid operations
      const validOperationPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        
        client.on('notification', (data) => {
          if (data.title === 'Joined Queue') {
            clearTimeout(timeout);
            resolve(true);
          }
        });
      });

      client.emit('join-queue', {
        name: 'Valid Team After Errors',
        members: 5
      });

      const validOperationSucceeded = await validOperationPromise;
      expect(validOperationSucceeded).toBe(true);

      // Should have received some errors but not crashed
      expect(errors.length).toBeGreaterThan(0);
      expect(client.connected).toBe(true);

      client.close();
    });

    it('should recover from temporary database connection issues', async () => {
      const client = await createClient();
      client.emit('join-room', { room: 'public' });

      // Add a team successfully first
      const successPromise = new Promise<boolean>((resolve) => {
        client.on('notification', (data) => {
          if (data.title === 'Joined Queue' && data.message.includes('Pre-Error Team')) {
            resolve(true);
          }
        });
      });

      client.emit('join-queue', {
        name: 'Pre-Error Team',
        members: 5
      });

      await successPromise;

      // Simulate database error by closing and reinitializing
      await closeDatabase();
      
      // Try operations during database downtime
      const errorPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 2000);
        
        client.on('error', (error) => {
          if (error.code === 'DATABASE_ERROR' || error.message.includes('database')) {
            clearTimeout(timeout);
            resolve(true);
          }
        });
      });

      client.emit('join-queue', {
        name: 'Error Team',
        members: 4
      });

      // Restore database
      await initializeDatabase(':memory:');
      
      // Verify system recovers
      const recoveryPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        
        client.on('notification', (data) => {
          if (data.title === 'Joined Queue' && data.message.includes('Recovery Team')) {
            clearTimeout(timeout);
            resolve(true);
          }
        });
      });

      client.emit('join-queue', {
        name: 'Recovery Team',
        members: 3
      });

      const recoverySucceeded = await recoveryPromise;
      expect(recoverySucceeded).toBe(true);

      client.close();
    });
  });
});