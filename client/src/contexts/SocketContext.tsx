import React, { createContext, useContext, ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import { 
  ConnectionStatus, 
  QueueUpdateData, 
  MatchUpdateData, 
  CourtStatusData, 
  NotificationData, 
  SocketErrorData 
} from '../types';

interface SocketContextType {
  socket: any;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  connectionError: string | null;
  
  // Core methods
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
  reconnect: () => void;
  
  // Typed event handlers
  onQueueUpdate: (callback: (data: QueueUpdateData) => void) => void;
  onMatchUpdate: (callback: (data: MatchUpdateData) => void) => void;
  onCourtStatus: (callback: (data: CourtStatusData) => void) => void;
  onNotification: (callback: (data: NotificationData) => void) => void;
  onError: (callback: (data: SocketErrorData) => void) => void;
  
  // Convenience methods
  joinQueue: (teamName: string, members: number, contactInfo?: string) => void;
  confirmResult: (matchId: string, teamId: string, confirmed: boolean) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
  serverUrl?: string;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ 
  children, 
  serverUrl 
}) => {
  const socketData = useSocket({ serverUrl });

  return (
    <SocketContext.Provider value={socketData}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
};