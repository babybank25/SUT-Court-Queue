import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  ConnectionStatus, 
  QueueUpdateData, 
  MatchUpdateData, 
  CourtStatusData, 
  NotificationData, 
  SocketErrorData 
} from '../types';

interface UseSocketOptions {
  serverUrl?: string;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const {
    serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000',
    autoConnect = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    connectionError: null,
    reconnectAttempts: 0
  });

  const socketRef = useRef<Socket | null>(null);
  const eventListenersRef = useRef<Map<string, Function[]>>(new Map());

  useEffect(() => {
    // Create socket connection
    socketRef.current = io(serverUrl, {
      autoConnect,
      reconnection: true,
      reconnectionAttempts,
      reconnectionDelay,
      timeout: 10000,
      forceNew: true
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('🔌 Connected to server:', socket.id);
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: true,
        connectionError: null,
        reconnectAttempts: 0,
        lastConnected: new Date()
      }));
      
      // Join public room by default
      socket.emit('join-room', { room: 'public' });
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from server:', reason);
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: false
      }));
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Connection error:', error);
      setConnectionStatus(prev => ({
        ...prev,
        connectionError: error.message,
        isConnected: false,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔌 Reconnected after', attemptNumber, 'attempts');
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: true,
        connectionError: null,
        reconnectAttempts: 0,
        lastConnected: new Date()
      }));
    });

    socket.on('reconnect_error', (error) => {
      console.error('🔌 Reconnection error:', error);
      setConnectionStatus(prev => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));
    });

    socket.on('reconnect_failed', () => {
      console.error('🔌 Reconnection failed after maximum attempts');
      setConnectionStatus(prev => ({
        ...prev,
        connectionError: 'Failed to reconnect after maximum attempts'
      }));
    });

    // Global error handler
    socket.on('error', (error: SocketErrorData) => {
      console.error('🔌 Socket error:', error);
      // You can emit this to a global error handler or notification system
    });

    // Cleanup on unmount
    return () => {
      console.log('🔌 Cleaning up socket connection');
      socket.disconnect();
      eventListenersRef.current.clear();
    };
  }, [serverUrl, autoConnect, reconnectionAttempts, reconnectionDelay]);

  // Enhanced emit function with error handling
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current && connectionStatus.isConnected) {
      console.log(`📤 Emitting ${event}:`, data);
      socketRef.current.emit(event, data);
    } else {
      console.warn(`📤 Cannot emit ${event}: Socket not connected`);
    }
  }, [connectionStatus.isConnected]);

  // Enhanced on function with listener tracking
  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      console.log(`📥 Registering listener for ${event}`);
      socketRef.current.on(event, callback);
      
      // Track listeners for cleanup
      const listeners = eventListenersRef.current.get(event) || [];
      listeners.push(callback);
      eventListenersRef.current.set(event, listeners);
    }
  }, []);

  // Enhanced off function
  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (socketRef.current) {
      console.log(`📥 Removing listener for ${event}`);
      if (callback) {
        socketRef.current.off(event, callback);
        
        // Remove from tracked listeners
        const listeners = eventListenersRef.current.get(event) || [];
        const filteredListeners = listeners.filter(l => l !== callback);
        if (filteredListeners.length > 0) {
          eventListenersRef.current.set(event, filteredListeners);
        } else {
          eventListenersRef.current.delete(event);
        }
      } else {
        socketRef.current.off(event);
        eventListenersRef.current.delete(event);
      }
    }
  }, []);

  // Typed event handlers for common events
  const onQueueUpdate = useCallback((callback: (data: QueueUpdateData) => void) => {
    on('queue-updated', callback);
  }, [on]);

  const onMatchUpdate = useCallback((callback: (data: MatchUpdateData) => void) => {
    on('match-updated', callback);
  }, [on]);

  const onCourtStatus = useCallback((callback: (data: CourtStatusData) => void) => {
    on('court-status', callback);
  }, [on]);

  const onNotification = useCallback((callback: (data: NotificationData) => void) => {
    on('notification', callback);
  }, [on]);

  const onError = useCallback((callback: (data: SocketErrorData) => void) => {
    on('error', callback);
  }, [on]);

  // Convenience methods for common actions
  const joinQueue = useCallback((teamName: string, members: number, contactInfo?: string) => {
    emit('join-queue', { teamName, members, contactInfo });
  }, [emit]);

  const confirmResult = useCallback((matchId: string, teamId: string, confirmed: boolean) => {
    emit('confirm-result', { matchId, teamId, confirmed });
  }, [emit]);

  const joinRoom = useCallback((room: string) => {
    emit('join-room', { room });
  }, [emit]);

  const leaveRoom = useCallback((room: string) => {
    emit('leave-room', { room });
  }, [emit]);

  // Manual reconnection
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Manual reconnection attempt');
      socketRef.current.connect();
    }
  }, []);

  return {
    socket: socketRef.current,
    connectionStatus,
    isConnected: connectionStatus.isConnected,
    connectionError: connectionStatus.connectionError,
    
    // Core methods
    emit,
    on,
    off,
    reconnect,
    
    // Typed event handlers
    onQueueUpdate,
    onMatchUpdate,
    onCourtStatus,
    onNotification,
    onError,
    
    // Convenience methods
    joinQueue,
    confirmResult,
    joinRoom,
    leaveRoom
  };
};