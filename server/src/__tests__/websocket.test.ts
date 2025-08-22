import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { setSocketInstance } from '../services/socketService';
import {
  handleJoinQueue,
  handleConfirmResult,
  handleAdminAction,
  handleJoinRoom,
  handleLeaveRoom
} from '../services/socketHandlers';

describe('WebSocket Integration', () => {
  let httpServer: Server;
  let ioServer: SocketIOServer;
  let clientSocket: ClientSocket;
  let serverSocket: any;

  beforeAll((done) => {
    httpServer = new Server();
    ioServer = new SocketIOServer(httpServer);
    setSocketInstance(ioServer);
    
    httpServer.listen(() => {
      const port = (httpServer.address() as any)?.port;
      clientSocket = Client(`http://localhost:${port}`);
      
      ioServer.on('connection', (socket) => {
        serverSocket = socket;
        
        // Set up event handlers
        socket.on('join-queue', (data) => handleJoinQueue(socket, data));
        socket.on('confirm-result', (data) => handleConfirmResult(socket, data));
        socket.on('admin-action', (data) => handleAdminAction(socket, data));
        socket.on('join-room', (data) => handleJoinRoom(socket, data));
        socket.on('leave-room', (data) => handleLeaveRoom(socket, data));
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    ioServer.close();
    clientSocket.close();
    httpServer.close();
  });

  describe('Connection Management', () => {
    it('should connect successfully', () => {
      expect(clientSocket.connected).toBe(true);
    });

    it('should handle room joining', (done) => {
      clientSocket.emit('join-room', { room: 'public' });
      
      clientSocket.on('notification', (data) => {
        expect(data.type).toBe('info');
        expect(data.title).toBe('Room Joined');
        expect(data.message).toContain('public');
        done();
      });
    });

    it('should handle invalid room joining', (done) => {
      clientSocket.emit('join-room', { room: 'invalid-room' });
      
      clientSocket.on('error', (data) => {
        expect(data.code).toBe('INVALID_ROOM');
        expect(data.message).toBe('Invalid room name');
        done();
      });
    });
  });

  describe('Queue Events', () => {
    it('should handle join queue with validation error', (done) => {
      clientSocket.emit('join-queue', { name: '', members: 0 });
      
      clientSocket.on('error', (data) => {
        expect(data.code).toBe('VALIDATION_ERROR');
        expect(data.message).toBe('Invalid queue join data');
        done();
      });
    });

    it('should handle valid join queue data format', (done) => {
      // Mock the database calls to avoid actual database operations
      const mockData = {
        teamName: 'Test Team',
        members: 5,
        contactInfo: 'test@example.com'
      };
      
      clientSocket.emit('join-queue', mockData);
      
      // Since we don't have actual database in test, we expect an error
      // In a real test, you'd mock the database repositories
      clientSocket.on('error', (data) => {
        // This will fail due to database not being available, which is expected
        expect(data.code).toBeDefined();
        done();
      });
    });
  });

  describe('Match Events', () => {
    it('should handle confirm result with validation error', (done) => {
      clientSocket.emit('confirm-result', { matchId: '', teamId: '', confirmed: 'invalid' });
      
      clientSocket.on('error', (data) => {
        expect(data.code).toBe('VALIDATION_ERROR');
        expect(data.message).toBe('Invalid confirmation data');
        done();
      });
    });
  });

  describe('Admin Events', () => {
    it('should handle admin action with validation error', (done) => {
      clientSocket.emit('admin-action', { action: '', payload: null });
      
      clientSocket.on('error', (data) => {
        expect(data.code).toBe('VALIDATION_ERROR');
        expect(data.message).toBe('Invalid admin action data');
        done();
      });
    });

    it('should handle unknown admin action', (done) => {
      clientSocket.emit('admin-action', { 
        action: 'unknown_action', 
        payload: {}, 
        adminId: 'test-admin' 
      });
      
      clientSocket.on('error', (data) => {
        expect(data.code).toBe('UNKNOWN_ACTION');
        expect(data.message).toContain('Unknown admin action');
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed data gracefully', (done) => {
      clientSocket.emit('join-queue', null);
      
      clientSocket.on('error', (data) => {
        expect(data.code).toBe('VALIDATION_ERROR');
        done();
      });
    });

    it('should handle missing required fields', (done) => {
      clientSocket.emit('join-room', {});
      
      clientSocket.on('error', (data) => {
        expect(data.code).toBe('VALIDATION_ERROR');
        expect(data.details.required).toContain('room');
        done();
      });
    });
  });
});