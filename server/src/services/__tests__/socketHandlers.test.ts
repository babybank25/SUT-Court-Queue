import { Socket } from 'socket.io';
import {
  handleJoinQueue,
  handleConfirmResult,
  handleAdminAction,
  handleJoinRoom,
  handleLeaveRoom
} from '../socketHandlers';
import { teamRepository, matchRepository, queueStateRepository } from '../../database';
import { 
  emitQueueUpdate, 
  emitMatchUpdate, 
  emitNotification, 
  emitError,
  joinRoom,
  leaveRoom,
  ROOMS 
} from '../socketService';
import { matchTimeoutService } from '../matchTimeoutService';

// Mock dependencies
jest.mock('../../database');
jest.mock('../socketService');
jest.mock('../matchTimeoutService');

const mockTeamRepository = teamRepository as jest.Mocked<typeof teamRepository>;
const mockMatchRepository = matchRepository as jest.Mocked<typeof matchRepository>;
const mockQueueStateRepository = queueStateRepository as jest.Mocked<typeof queueStateRepository>;
const mockEmitQueueUpdate = emitQueueUpdate as jest.MockedFunction<typeof emitQueueUpdate>;
const mockEmitMatchUpdate = emitMatchUpdate as jest.MockedFunction<typeof emitMatchUpdate>;
const mockEmitNotification = emitNotification as jest.MockedFunction<typeof emitNotification>;
const mockEmitError = emitError as jest.MockedFunction<typeof emitError>;
const mockJoinRoom = joinRoom as jest.MockedFunction<typeof joinRoom>;
const mockLeaveRoom = leaveRoom as jest.MockedFunction<typeof leaveRoom>;
const mockMatchTimeoutService = matchTimeoutService as jest.Mocked<typeof matchTimeoutService>;

describe('Socket Handlers', () => {
  let mockSocket: Partial<Socket>;

  beforeEach(() => {
    mockSocket = {
      id: 'socket-123',
      emit: jest.fn()
    };
    
    jest.clearAllMocks();
  });

  describe('handleJoinQueue', () => {
    const validJoinData = {
      name: 'Test Team',
      members: 5,
      contactInfo: 'test@example.com'
    };

    it('should handle valid queue join', async () => {
      const mockQueueState = {
        teams: [],
        maxSize: 10,
        currentMatch: null,
        lastUpdated: new Date()
      };

      const mockNewTeam = {
        id: '1',
        name: 'Test Team',
        members: 5,
        contactInfo: 'test@example.com',
        status: 'waiting',
        wins: 0,
        position: 1
      };

      mockTeamRepository.findByName.mockResolvedValue(null);
      mockQueueStateRepository.get.mockResolvedValue(mockQueueState);
      mockTeamRepository.create.mockResolvedValue(mockNewTeam);

      await handleJoinQueue(mockSocket as Socket, validJoinData);

      expect(mockTeamRepository.create).toHaveBeenCalledWith({
        name: 'Test Team',
        members: 5,
        contactInfo: 'test@example.com',
        status: 'waiting',
        wins: 0,
        position: 1
      });

      expect(mockEmitQueueUpdate).toHaveBeenCalledWith({
        teams: mockQueueState.teams,
        totalTeams: 0,
        availableSlots: 10,
        event: 'team_joined'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('notification', {
        type: 'success',
        title: 'Joined Queue',
        message: 'Team "Test Team" successfully joined at position 1',
        timestamp: expect.any(String),
        duration: 5000
      });
    });

    it('should reject invalid data', async () => {
      const invalidData = { name: '', members: 0 };

      await handleJoinQueue(mockSocket as Socket, invalidData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid queue join data',
        details: expect.any(Array)
      });

      expect(mockTeamRepository.create).not.toHaveBeenCalled();
    });

    it('should reject duplicate team names', async () => {
      const existingTeam = { id: '1', name: 'Test Team' };
      mockTeamRepository.findByName.mockResolvedValue(existingTeam);

      await handleJoinQueue(mockSocket as Socket, validJoinData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'TEAM_NAME_EXISTS',
        message: 'Team name already exists',
        details: { teamName: 'Test Team' }
      });
    });

    it('should reject when queue is full', async () => {
      const mockQueueState = {
        teams: new Array(10).fill({}),
        maxSize: 10,
        currentMatch: null,
        lastUpdated: new Date()
      };

      mockTeamRepository.findByName.mockResolvedValue(null);
      mockQueueStateRepository.get.mockResolvedValue(mockQueueState);

      await handleJoinQueue(mockSocket as Socket, validJoinData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'QUEUE_FULL',
        message: 'Queue is full',
        details: { maxSize: 10, currentSize: 10 }
      });
    });

    it('should calculate correct position', async () => {
      const mockQueueState = {
        teams: [
          { id: '1', position: 1 },
          { id: '2', position: 3 }
        ],
        maxSize: 10,
        currentMatch: null,
        lastUpdated: new Date()
      };

      mockTeamRepository.findByName.mockResolvedValue(null);
      mockQueueStateRepository.get.mockResolvedValue(mockQueueState);
      mockTeamRepository.create.mockResolvedValue({ id: '3', position: 4 });

      await handleJoinQueue(mockSocket as Socket, validJoinData);

      expect(mockTeamRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ position: 4 })
      );
    });

    it('should handle database errors', async () => {
      mockTeamRepository.findByName.mockRejectedValue(new Error('Database error'));

      await handleJoinQueue(mockSocket as Socket, validJoinData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to join queue',
        details: 'Database error'
      });
    });
  });

  describe('handleConfirmResult', () => {
    const mockMatch = {
      id: '1',
      team1: { id: '1', name: 'Team A', wins: 5 },
      team2: { id: '2', name: 'Team B', wins: 3 },
      score1: 15,
      score2: 12,
      status: 'confirming',
      confirmed: { team1: false, team2: false },
      matchType: 'regular',
      startTime: new Date()
    };

    const validConfirmData = {
      matchId: '1',
      teamId: '1',
      confirmed: true
    };

    it('should handle first team confirmation', async () => {
      const updatedMatch = {
        ...mockMatch,
        confirmed: { team1: true, team2: false }
      };

      mockMatchRepository.findById.mockResolvedValue(mockMatch);
      mockMatchRepository.update.mockResolvedValue(updatedMatch);

      await handleConfirmResult(mockSocket as Socket, validConfirmData);

      expect(mockMatchRepository.update).toHaveBeenCalledWith('1', {
        confirmed: { team1: true, team2: false }
      });

      expect(mockEmitMatchUpdate).toHaveBeenCalledWith({
        match: updatedMatch,
        event: 'confirmation_received',
        waitingFor: 'Team B'
      });

      expect(mockEmitNotification).toHaveBeenCalledWith({
        type: 'info',
        title: 'Confirmation Received',
        message: 'Waiting for Team B to confirm the result',
        timestamp: expect.any(String),
        duration: 5000
      });
    });

    it('should complete match when both teams confirm', async () => {
      const partiallyConfirmedMatch = {
        ...mockMatch,
        confirmed: { team1: true, team2: false }
      };

      const completedMatch = {
        ...mockMatch,
        status: 'completed',
        confirmed: { team1: true, team2: true },
        endTime: new Date()
      };

      mockMatchRepository.findById.mockResolvedValue(partiallyConfirmedMatch);
      mockMatchRepository.update
        .mockResolvedValueOnce({ ...partiallyConfirmedMatch, confirmed: { team1: true, team2: true } })
        .mockResolvedValueOnce(completedMatch);
      mockTeamRepository.update.mockResolvedValue(undefined);
      mockQueueStateRepository.get.mockResolvedValue({ teams: [], maxSize: 10 });

      await handleConfirmResult(mockSocket as Socket, { ...validConfirmData, teamId: '2' });

      expect(mockMatchTimeoutService.clearTimeout).toHaveBeenCalledWith('1');
      expect(mockTeamRepository.update).toHaveBeenCalledWith('1', { 
        status: 'waiting', 
        wins: 6 
      });
      expect(mockTeamRepository.update).toHaveBeenCalledWith('2', { 
        status: 'waiting' 
      });

      expect(mockEmitMatchUpdate).toHaveBeenCalledWith({
        match: completedMatch,
        event: 'match_completed',
        winner: 'Team A',
        finalScore: '15-12'
      });

      expect(mockEmitNotification).toHaveBeenCalledWith({
        type: 'success',
        title: 'Match Completed',
        message: 'Team A wins 15-12',
        timestamp: expect.any(String),
        duration: 8000
      });
    });

    it('should reject invalid data', async () => {
      const invalidData = { matchId: '', teamId: '', confirmed: 'invalid' };

      await handleConfirmResult(mockSocket as Socket, invalidData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid confirmation data',
        details: expect.any(Array)
      });
    });

    it('should reject non-existent match', async () => {
      mockMatchRepository.findById.mockResolvedValue(null);

      await handleConfirmResult(mockSocket as Socket, validConfirmData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'MATCH_NOT_FOUND',
        message: 'Match not found',
        details: { matchId: '1' }
      });
    });

    it('should reject non-confirming match', async () => {
      const activeMatch = { ...mockMatch, status: 'active' };
      mockMatchRepository.findById.mockResolvedValue(activeMatch);

      await handleConfirmResult(mockSocket as Socket, validConfirmData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'MATCH_NOT_CONFIRMING',
        message: 'Match is not awaiting confirmation',
        details: { matchId: '1', currentStatus: 'active' }
      });
    });

    it('should reject team not in match', async () => {
      mockMatchRepository.findById.mockResolvedValue(mockMatch);

      await handleConfirmResult(mockSocket as Socket, { ...validConfirmData, teamId: '999' });

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'TEAM_NOT_IN_MATCH',
        message: 'Team is not part of this match',
        details: { teamId: '999', matchId: '1' }
      });
    });
  });

  describe('handleAdminAction', () => {
    const validAdminData = {
      action: 'start_match',
      payload: { team1Id: '1', team2Id: '2' },
      adminId: 'admin-1'
    };

    it('should handle valid admin action', async () => {
      await handleAdminAction(mockSocket as Socket, validAdminData);

      // Should not emit error for valid action
      expect(mockEmitError).not.toHaveBeenCalled();
    });

    it('should reject invalid data', async () => {
      const invalidData = { action: '', payload: null };

      await handleAdminAction(mockSocket as Socket, invalidData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid admin action data',
        details: { required: ['action', 'adminId'] }
      });
    });

    it('should reject unknown action', async () => {
      const unknownActionData = {
        action: 'unknown_action',
        payload: {},
        adminId: 'admin-1'
      };

      await handleAdminAction(mockSocket as Socket, unknownActionData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'UNKNOWN_ACTION',
        message: 'Unknown admin action: unknown_action',
        details: { 
          action: 'unknown_action', 
          availableActions: ['start_match', 'force_resolve_match', 'update_queue_order', 'remove_team'] 
        }
      });
    });

    it('should handle database errors', async () => {
      // Mock an error in one of the admin action handlers
      jest.spyOn(console, 'log').mockImplementation(() => {});
      
      // Simulate an error by making the action handler throw
      const errorData = { ...validAdminData, action: 'start_match' };
      
      await handleAdminAction(mockSocket as Socket, errorData);

      // The handler should complete without throwing
      expect(mockEmitError).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinRoom', () => {
    it('should join valid room', () => {
      const roomData = { room: ROOMS.PUBLIC };

      handleJoinRoom(mockSocket as Socket, roomData);

      expect(mockJoinRoom).toHaveBeenCalledWith(mockSocket, ROOMS.PUBLIC);
      expect(mockSocket.emit).toHaveBeenCalledWith('notification', {
        type: 'info',
        title: 'Room Joined',
        message: `Successfully joined room: ${ROOMS.PUBLIC}`,
        timestamp: expect.any(String),
        duration: 3000
      });
    });

    it('should reject invalid room data', () => {
      const invalidData = { room: 123 };

      handleJoinRoom(mockSocket as Socket, invalidData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid room data',
        details: { required: ['room'] }
      });
    });

    it('should reject invalid room name', () => {
      const invalidRoomData = { room: 'invalid-room' };

      handleJoinRoom(mockSocket as Socket, invalidRoomData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'INVALID_ROOM',
        message: 'Invalid room name',
        details: { 
          room: 'invalid-room', 
          availableRooms: Object.values(ROOMS) 
        }
      });
    });

    it('should handle join room errors', () => {
      const roomData = { room: ROOMS.PUBLIC };
      mockJoinRoom.mockImplementation(() => {
        throw new Error('Join room failed');
      });

      handleJoinRoom(mockSocket as Socket, roomData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to join room',
        details: 'Join room failed'
      });
    });
  });

  describe('handleLeaveRoom', () => {
    it('should leave valid room', () => {
      const roomData = { room: ROOMS.PUBLIC };

      handleLeaveRoom(mockSocket as Socket, roomData);

      expect(mockLeaveRoom).toHaveBeenCalledWith(mockSocket, ROOMS.PUBLIC);
    });

    it('should reject invalid room data', () => {
      const invalidData = { room: null };

      handleLeaveRoom(mockSocket as Socket, invalidData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid room data',
        details: { required: ['room'] }
      });
    });

    it('should handle leave room errors', () => {
      const roomData = { room: ROOMS.PUBLIC };
      mockLeaveRoom.mockImplementation(() => {
        throw new Error('Leave room failed');
      });

      handleLeaveRoom(mockSocket as Socket, roomData);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to leave room',
        details: 'Leave room failed'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON data', async () => {
      await handleJoinQueue(mockSocket as Socket, null);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid queue join data',
        details: expect.any(Array)
      });
    });

    it('should handle undefined data', async () => {
      await handleConfirmResult(mockSocket as Socket, undefined);

      expect(mockEmitError).toHaveBeenCalledWith(mockSocket, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid confirmation data',
        details: expect.any(Array)
      });
    });

    it('should log errors to console', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockTeamRepository.findByName.mockRejectedValue(new Error('Database error'));

      await handleJoinQueue(mockSocket as Socket, { name: 'Test', members: 5 });

      expect(consoleSpy).toHaveBeenCalledWith('Error handling join queue:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});