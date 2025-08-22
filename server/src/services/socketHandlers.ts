import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { teamRepository, matchRepository, queueStateRepository } from '../database';
import {
  emitQueueUpdate,
  emitMatchUpdate,
  emitNotification,
  emitError,
  joinRoom,
  leaveRoom,
  ROOMS
} from './socketService';
import { JoinQueueInputSchema, ConfirmMatchInputSchema } from '../types/validation';
import { SocketErrorData, NotificationData } from '../types';
import { matchTimeoutService } from './matchTimeoutService';

// Handle team joining queue via WebSocket
export const handleJoinQueue = async (socket: Socket, data: any) => {
  try {
    console.log(`Socket ${socket.id} attempting to join queue:`, data);
    
    // Validate input data
    const validationResult = JoinQueueInputSchema.safeParse(data);
    if (!validationResult.success) {
      const error: SocketErrorData = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid queue join data',
        details: validationResult.error.errors
      };
      emitError(socket, error);
      return;
    }
    
    const { name, members, contactInfo } = validationResult.data;
    
    // Check if team name already exists
    const existingTeam = await teamRepository.findByName(name);
    if (existingTeam) {
      const error: SocketErrorData = {
        code: 'TEAM_NAME_EXISTS',
        message: 'Team name already exists',
        details: { teamName: name }
      };
      emitError(socket, error);
      return;
    }
    
    // Get current queue state
    const queueState = await queueStateRepository.get();
    
    // Check if queue is full
    if (queueState.teams.length >= queueState.maxSize) {
      const error: SocketErrorData = {
        code: 'QUEUE_FULL',
        message: 'Queue is full',
        details: { maxSize: queueState.maxSize, currentSize: queueState.teams.length }
      };
      emitError(socket, error);
      return;
    }
    
    // Calculate next position
    const nextPosition = queueState.teams.length > 0 
      ? Math.max(...queueState.teams.map(t => t.position || 0)) + 1 
      : 1;
    
    // Create new team
    const newTeam = await teamRepository.create({
      name,
      members,
      contactInfo,
      status: 'waiting',
      wins: 0,
      position: nextPosition
    });
    
    // Get updated queue state
    const updatedQueueState = await queueStateRepository.get();
    
    // Emit queue update to all clients
    emitQueueUpdate({
      teams: updatedQueueState.teams,
      totalTeams: updatedQueueState.teams.length,
      availableSlots: updatedQueueState.maxSize - updatedQueueState.teams.length,
      event: 'team_joined'
    });
    
    // Send success notification to the joining team
    const notification: NotificationData = {
      type: 'success',
      title: 'Joined Queue',
      message: `Team "${name}" successfully joined at position ${nextPosition}`,
      timestamp: new Date().toISOString(),
      duration: 5000
    };
    socket.emit('notification', notification);
    
    console.log(`Team "${name}" joined queue at position ${nextPosition} via WebSocket`);
    
  } catch (error) {
    console.error('Error handling join queue:', error);
    const socketError: SocketErrorData = {
      code: 'INTERNAL_ERROR',
      message: 'Failed to join queue',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    emitError(socket, socketError);
  }
};

// Handle match result confirmation via WebSocket
export const handleConfirmResult = async (socket: Socket, data: any) => {
  try {
    console.log(`Socket ${socket.id} attempting to confirm match result:`, data);
    
    // Validate input data
    const validationResult = ConfirmMatchInputSchema.safeParse(data);
    if (!validationResult.success) {
      const error: SocketErrorData = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid confirmation data',
        details: validationResult.error.errors
      };
      emitError(socket, error);
      return;
    }
    
    const { matchId, teamId, confirmed } = validationResult.data;
    
    // Find the match
    const match = await matchRepository.findById(matchId);
    if (!match) {
      const error: SocketErrorData = {
        code: 'MATCH_NOT_FOUND',
        message: 'Match not found',
        details: { matchId }
      };
      emitError(socket, error);
      return;
    }
    
    // Check if match is in confirming state
    if (match.status !== 'confirming') {
      const error: SocketErrorData = {
        code: 'MATCH_NOT_CONFIRMING',
        message: 'Match is not awaiting confirmation',
        details: { matchId, currentStatus: match.status }
      };
      emitError(socket, error);
      return;
    }
    
    // Verify team is part of this match
    if (teamId !== match.team1.id && teamId !== match.team2.id) {
      const error: SocketErrorData = {
        code: 'TEAM_NOT_IN_MATCH',
        message: 'Team is not part of this match',
        details: { teamId, matchId }
      };
      emitError(socket, error);
      return;
    }
    
    // Update confirmation status
    const updatedConfirmed = { ...match.confirmed };
    if (teamId === match.team1.id) {
      updatedConfirmed.team1 = confirmed;
    } else {
      updatedConfirmed.team2 = confirmed;
    }
    
    let updatedMatch = await matchRepository.update(matchId, {
      confirmed: updatedConfirmed
    });
    
    // Check if both teams have confirmed
    if (updatedConfirmed.team1 && updatedConfirmed.team2) {
      // Clear any existing timeout since both teams confirmed
      matchTimeoutService.clearTimeout(matchId);
      
      // Both teams confirmed - complete the match
      updatedMatch = await matchRepository.update(matchId, {
        status: 'completed',
        endTime: new Date()
      });
      
      // Update team statuses and wins
      const winner = match.score1 > match.score2 ? match.team1 : match.team2;
      const loser = match.score1 > match.score2 ? match.team2 : match.team1;
      
      await Promise.all([
        teamRepository.update(winner.id, { 
          status: match.matchType === 'champion-return' ? 'cooldown' : 'waiting',
          wins: winner.wins + 1 
        }),
        teamRepository.update(loser.id, { 
          status: 'waiting' 
        })
      ]);
      
      // Emit match completion update
      emitMatchUpdate({
        match: updatedMatch,
        event: 'match_completed',
        winner: winner.name,
        finalScore: `${match.score1}-${match.score2}`
      });
      
      // Emit queue update since team statuses changed
      const updatedQueueState = await queueStateRepository.get();
      emitQueueUpdate({
        teams: updatedQueueState.teams,
        totalTeams: updatedQueueState.teams.length,
        availableSlots: updatedQueueState.maxSize - updatedQueueState.teams.length,
        event: 'match_completed',
        completedMatch: updatedMatch
      });
      
      // Send completion notification
      const notification: NotificationData = {
        type: 'success',
        title: 'Match Completed',
        message: `${winner.name} wins ${match.score1}-${match.score2}`,
        timestamp: new Date().toISOString(),
        duration: 8000
      };
      emitNotification(notification);
      
      console.log(`Match ${matchId} completed via WebSocket confirmation`);
      
    } else {
      // Still waiting for other team's confirmation
      const waitingFor = updatedConfirmed.team1 ? match.team2.name : match.team1.name;
      
      emitMatchUpdate({
        match: updatedMatch,
        event: 'confirmation_received',
        waitingFor
      });
      
      // Send waiting notification
      const notification: NotificationData = {
        type: 'info',
        title: 'Confirmation Received',
        message: `Waiting for ${waitingFor} to confirm the result`,
        timestamp: new Date().toISOString(),
        duration: 5000
      };
      emitNotification(notification);
      
      console.log(`Match ${matchId} confirmation received from team ${teamId}, waiting for ${waitingFor}`);
    }
    
  } catch (error) {
    console.error('Error handling confirm result:', error);
    const socketError: SocketErrorData = {
      code: 'INTERNAL_ERROR',
      message: 'Failed to confirm match result',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    emitError(socket, socketError);
  }
};

// Handle admin actions via WebSocket
export const handleAdminAction = async (socket: Socket, data: any) => {
  try {
    console.log(`Socket ${socket.id} attempting admin action:`, data);
    
    // Basic validation for admin actions
    if (!data || typeof data.action !== 'string' || !data.adminId || !data.token) {
      const error: SocketErrorData = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid admin action data',
        details: { required: ['action', 'adminId', 'token'] }
      };
      emitError(socket, error);
      return;
    }

    const { action, payload, adminId, token } = data;

    // Verify admin token using authenticateToken logic
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      if (!user || !user.isAdmin) {
        const error: SocketErrorData = {
          code: 'ADMIN_REQUIRED',
          message: 'Admin privileges required'
        };
        emitError(socket, error);
        return;
      }
    } catch (err) {
      const error: SocketErrorData = {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      };
      emitError(socket, error);
      return;
    }

    // Token verified - proceed with admin action
    
    switch (action) {
      case 'start_match':
        await handleAdminStartMatch(socket, payload, adminId);
        break;
        
      case 'force_resolve_match':
        await handleAdminForceResolve(socket, payload, adminId);
        break;
        
      case 'update_queue_order':
        await handleAdminUpdateQueue(socket, payload, adminId);
        break;
        
      case 'remove_team':
        await handleAdminRemoveTeam(socket, payload, adminId);
        break;
        
      default:
        const error: SocketErrorData = {
          code: 'UNKNOWN_ACTION',
          message: `Unknown admin action: ${action}`,
          details: { action, availableActions: ['start_match', 'force_resolve_match', 'update_queue_order', 'remove_team'] }
        };
        emitError(socket, error);
    }
    
  } catch (error) {
    console.error('Error handling admin action:', error);
    const socketError: SocketErrorData = {
      code: 'INTERNAL_ERROR',
      message: 'Failed to execute admin action',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    emitError(socket, socketError);
  }
};

// Handle room joining
export const handleJoinRoom = (socket: Socket, data: any) => {
  try {
    if (!data || typeof data.room !== 'string') {
      const error: SocketErrorData = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid room data',
        details: { required: ['room'] }
      };
      emitError(socket, error);
      return;
    }
    
    const { room } = data;
    
    // Validate room name
    if (!Object.values(ROOMS).includes(room as any)) {
      const error: SocketErrorData = {
        code: 'INVALID_ROOM',
        message: 'Invalid room name',
        details: { room, availableRooms: Object.values(ROOMS) }
      };
      emitError(socket, error);
      return;
    }
    
    joinRoom(socket, room);
    
    // Send confirmation
    const notification: NotificationData = {
      type: 'info',
      title: 'Room Joined',
      message: `Successfully joined room: ${room}`,
      timestamp: new Date().toISOString(),
      duration: 3000
    };
    socket.emit('notification', notification);
    
  } catch (error) {
    console.error('Error handling join room:', error);
    const socketError: SocketErrorData = {
      code: 'INTERNAL_ERROR',
      message: 'Failed to join room',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    emitError(socket, socketError);
  }
};

// Handle room leaving
export const handleLeaveRoom = (socket: Socket, data: any) => {
  try {
    if (!data || typeof data.room !== 'string') {
      const error: SocketErrorData = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid room data',
        details: { required: ['room'] }
      };
      emitError(socket, error);
      return;
    }
    
    const { room } = data;
    leaveRoom(socket, room);
    
    console.log(`Socket ${socket.id} left room: ${room}`);
    
  } catch (error) {
    console.error('Error handling leave room:', error);
    const socketError: SocketErrorData = {
      code: 'INTERNAL_ERROR',
      message: 'Failed to leave room',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    emitError(socket, socketError);
  }
};

// Admin action handlers
async function handleAdminStartMatch(socket: Socket, payload: any, adminId: string) {
  // TODO: Implement admin start match logic
  console.log(`Admin ${adminId} starting match:`, payload);
  
  const notification: NotificationData = {
    type: 'info',
    title: 'Admin Action',
    message: 'Match start functionality will be implemented in admin tasks',
    timestamp: new Date().toISOString(),
    duration: 5000
  };
  emitNotification(notification, ROOMS.ADMIN);
}

async function handleAdminForceResolve(socket: Socket, payload: any, adminId: string) {
  // TODO: Implement admin force resolve logic
  console.log(`Admin ${adminId} force resolving match:`, payload);
  
  const notification: NotificationData = {
    type: 'info',
    title: 'Admin Action',
    message: 'Force resolve functionality will be implemented in admin tasks',
    timestamp: new Date().toISOString(),
    duration: 5000
  };
  emitNotification(notification, ROOMS.ADMIN);
}

async function handleAdminUpdateQueue(socket: Socket, payload: any, adminId: string) {
  // TODO: Implement admin queue update logic
  console.log(`Admin ${adminId} updating queue:`, payload);
  
  const notification: NotificationData = {
    type: 'info',
    title: 'Admin Action',
    message: 'Queue update functionality will be implemented in admin tasks',
    timestamp: new Date().toISOString(),
    duration: 5000
  };
  emitNotification(notification, ROOMS.ADMIN);
}

async function handleAdminRemoveTeam(socket: Socket, payload: any, adminId: string) {
  // TODO: Implement admin remove team logic
  console.log(`Admin ${adminId} removing team:`, payload);
  
  const notification: NotificationData = {
    type: 'info',
    title: 'Admin Action',
    message: 'Team removal functionality will be implemented in admin tasks',
    timestamp: new Date().toISOString(),
    duration: 5000
  };
  emitNotification(notification, ROOMS.ADMIN);
}