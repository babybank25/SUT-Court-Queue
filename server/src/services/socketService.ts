import { Server, Socket } from 'socket.io';
import { 
  QueueUpdateData, 
  MatchUpdateData, 
  CourtStatusData, 
  NotificationData,
  SocketErrorData 
} from '../types';

let io: Server | null = null;

// Room constants
export const ROOMS = {
  PUBLIC: 'public',
  ADMIN: 'admin',
  MATCH: 'match'
} as const;

export const setSocketInstance = (socketInstance: Server) => {
  io = socketInstance;
};

export const getSocketInstance = (): Server => {
  if (!io) {
    throw new Error('Socket.IO instance not initialized');
  }
  return io;
};

// Connection management
export const handleConnection = (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Join public room by default
  socket.join(ROOMS.PUBLIC);
  
  // Send current court status to new connection
  emitCourtStatusToSocket(socket);
  
  return socket;
};

export const handleDisconnection = (socket: Socket) => {
  console.log(`Client disconnected: ${socket.id}`);
  // Cleanup is handled automatically by Socket.IO
};

// Room management
export const joinRoom = (socket: Socket, room: string) => {
  socket.join(room);
  console.log(`Socket ${socket.id} joined room: ${room}`);
};

export const leaveRoom = (socket: Socket, room: string) => {
  socket.leave(room);
  console.log(`Socket ${socket.id} left room: ${room}`);
};

// Emit functions with proper typing
export const emitQueueUpdate = (data: QueueUpdateData, room: string = ROOMS.PUBLIC) => {
  if (io) {
    io.to(room).emit('queue-updated', data);
    console.log(`Queue update emitted to room: ${room}`, { totalTeams: data.totalTeams });
  }
};

export const emitMatchUpdate = (data: MatchUpdateData, room: string = ROOMS.PUBLIC) => {
  if (io) {
    io.to(room).emit('match-updated', data);
    console.log(`Match update emitted to room: ${room}`, { event: data.event, matchId: data.match.id });
  }
};

export const emitCourtStatusUpdate = (data: CourtStatusData, room: string = ROOMS.PUBLIC) => {
  if (io) {
    io.to(room).emit('court-status', data);
    console.log(`Court status update emitted to room: ${room}`, { isOpen: data.isOpen, mode: data.mode });
  }
};

export const emitNotification = (data: NotificationData, room: string = ROOMS.PUBLIC) => {
  if (io) {
    io.to(room).emit('notification', data);
    console.log(`Notification emitted to room: ${room}`, { type: data.type, title: data.title });
  }
};

export const emitError = (socket: Socket, error: SocketErrorData) => {
  socket.emit('error', error);
  console.log(`Error emitted to socket ${socket.id}:`, error);
};

// Send current court status to a specific socket
export const emitCourtStatusToSocket = (socket: Socket) => {
  const currentStatus: CourtStatusData = {
    isOpen: true, // This would come from actual court status service
    currentTime: new Date().toISOString(),
    timezone: 'Asia/Bangkok',
    mode: 'regular',
    activeMatches: 0 // This would come from match service
  };
  
  socket.emit('court-status', currentStatus);
};

// Broadcast to all connected clients
export const broadcast = (event: string, data: any) => {
  if (io) {
    io.emit(event, data);
    console.log(`Broadcast event: ${event}`);
  }
};

// Get connection statistics
export const getConnectionStats = () => {
  if (!io) return { total: 0, rooms: {} };
  
  const sockets = io.sockets.sockets;
  const total = sockets.size;
  
  const rooms: Record<string, number> = {};
  Object.values(ROOMS).forEach(room => {
    const roomSockets = io.sockets.adapter.rooms.get(room);
    rooms[room] = roomSockets ? roomSockets.size : 0;
  });
  
  return { total, rooms };
};