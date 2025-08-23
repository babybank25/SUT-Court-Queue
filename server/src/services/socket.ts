import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { monitoring } from '../utils/monitoring';
import { handleConnection, handleDisconnection, setSocketInstance } from './socketService';
import {
  handleJoinQueue,
  handleConfirmResult,
  handleAdminAction,
  handleJoinRoom,
  handleLeaveRoom
} from './socketHandlers';
import { corsOptions } from '../config/cors';

export const setupSocketIO = (server: import('http').Server) => {
  const io = new Server(server, {
    cors: {
      ...corsOptions,
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true
    }
  });

  setSocketInstance(io);

  io.on('connection', (socket: Socket) => {
    handleConnection(socket);
    monitoring.setActiveConnections(io.engine.clientsCount);

    socket.on('join-queue', (data) => handleJoinQueue(socket, data));
    socket.on('confirm-result', (data) => handleConfirmResult(socket, data));
    socket.on('admin-action', (data) => handleAdminAction(socket, data));
    socket.on('join-room', (data) => handleJoinRoom(socket, data));
    socket.on('leave-room', (data) => handleLeaveRoom(socket, data));

    socket.on('disconnect', () => {
      handleDisconnection(socket);
      monitoring.setActiveConnections(io.engine.clientsCount);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error from ${socket.id}`, error);
      monitoring.incrementErrors(`Socket error: ${error.message}`);
    });
  });

  return io;
};
