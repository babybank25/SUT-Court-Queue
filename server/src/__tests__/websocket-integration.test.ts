import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { setSocketInstance, emitQueueUpdate, emitMatchUpdate, emitCourtStatusUpdate } from '../services/socketService';

describe('WebSocket Real-time Integration', () => {
  let httpServer: Server;
  let ioServer: SocketIOServer;
  let clientSocket: ClientSocket;

  beforeAll((done) => {
    httpServer = new Server();
    ioServer = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    setSocketInstance(ioServer);
    
    httpServer.listen(() => {
      const port = (httpServer.address() as any)?.port;
      clientSocket = Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    ioServer.close();
    clientSocket.close();
    httpServer.close();
  });

  describe('Real-time Event Broadcasting', () => {
    it('should emit queue updates to connected clients', (done) => {
      const mockQueueData = {
        teams: [],
        totalTeams: 0,
        availableSlots: 10,
        event: 'team_joined'
      };

      clientSocket.on('queue-updated', (data) => {
        expect(data.event).toBe('team_joined');
        expect(data.totalTeams).toBe(0);
        expect(data.availableSlots).toBe(10);
        done();
      });

      // Emit queue update from server
      emitQueueUpdate(mockQueueData);
    });

    it('should emit match updates to connected clients', (done) => {
      const mockMatchData = {
        match: {
          id: 'test-match-1',
          team1: { id: '1', name: 'Team A', members: 5, status: 'playing' as const, wins: 0, lastSeen: new Date() },
          team2: { id: '2', name: 'Team B', members: 5, status: 'playing' as const, wins: 0, lastSeen: new Date() },
          score1: 10,
          score2: 8,
          status: 'active' as const,
          startTime: new Date(),
          targetScore: 21,
          matchType: 'regular' as const,
          confirmed: { team1: false, team2: false }
        },
        event: 'score_updated' as const,
        score: '10-8'
      };

      clientSocket.on('match-updated', (data) => {
        expect(data.event).toBe('score_updated');
        expect(data.score).toBe('10-8');
        expect(data.match.score1).toBe(10);
        expect(data.match.score2).toBe(8);
        done();
      });

      // Emit match update from server
      emitMatchUpdate(mockMatchData);
    });

    it('should emit court status updates to connected clients', (done) => {
      const mockCourtData = {
        isOpen: true,
        currentTime: new Date().toISOString(),
        timezone: 'Asia/Bangkok',
        mode: 'regular' as const,
        activeMatches: 1
      };

      clientSocket.on('court-status', (data) => {
        expect(data.isOpen).toBe(true);
        expect(data.mode).toBe('regular');
        expect(data.activeMatches).toBe(1);
        expect(data.timezone).toBe('Asia/Bangkok');
        done();
      });

      // Emit court status update from server
      emitCourtStatusUpdate(mockCourtData);
    });
  });

  describe('Connection Management', () => {
    it('should maintain connection status', () => {
      expect(clientSocket.connected).toBe(true);
    });

    it('should handle reconnection', (done) => {
      let reconnected = false;
      
      clientSocket.on('reconnect', () => {
        reconnected = true;
        expect(reconnected).toBe(true);
        done();
      });

      // Simulate disconnect and reconnect
      clientSocket.disconnect();
      setTimeout(() => {
        clientSocket.connect();
      }, 100);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', (done) => {
      const errorClient = Client('http://localhost:99999'); // Invalid port
      
      errorClient.on('connect_error', (error) => {
        expect(error).toBeDefined();
        errorClient.close();
        done();
      });
    });
  });
});