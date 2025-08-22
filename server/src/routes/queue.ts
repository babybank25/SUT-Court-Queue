import { Router } from 'express';
import { database, teamRepository, queueStateRepository } from '../database';
import { validateBody, asyncHandler, AppError } from '../middleware';
import { JoinQueueInputSchema } from '../types/validation';
import { emitQueueUpdate } from '../services/socketService';

const router = Router();

// GET /api/queue - Get current queue
router.get('/', asyncHandler(async (req, res) => {
  const queueState = await queueStateRepository.get();
  
  res.json({
    success: true,
    data: {
      teams: queueState.teams,
      maxSize: queueState.maxSize,
      currentMatch: queueState.currentMatch,
      lastUpdated: queueState.lastUpdated,
      totalTeams: queueState.teams.length,
      availableSlots: queueState.maxSize - queueState.teams.length
    }
  });
}));

// POST /api/queue/join - Join the queue
router.post('/join', 
  validateBody(JoinQueueInputSchema),
  asyncHandler(async (req, res) => {
    const { name, members, contactInfo } = req.body;
    
    // Check if team name already exists
    const existingTeam = await teamRepository.findByName(name);
    if (existingTeam) {
      throw new AppError('Team name already exists', 400, 'TEAM_NAME_EXISTS');
    }
    
    const MAX_RETRIES = 5;
    let newTeam;
    let nextPosition = 0;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await database.transaction(async () => {
          // Get current queue state inside the transaction
          const queueState = await queueStateRepository.get();

          // Check if queue is full
          if (queueState.teams.length >= queueState.maxSize) {
            throw new AppError('Queue is full', 400, 'QUEUE_FULL');
          }

          // Calculate next position
          nextPosition = queueState.teams.length > 0
            ? Math.max(...queueState.teams.map(t => t.position || 0)) + 1
            : 1;

          // Create new team
          newTeam = await teamRepository.create({
            name,
            members,
            contactInfo,
            status: 'waiting',
            wins: 0,
            position: nextPosition
          });
        });
        break;
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        if (err?.message?.includes('UNIQUE constraint failed: teams.position') && attempt < MAX_RETRIES - 1) {
          continue; // Retry on position conflict
        }
        throw err;
      }
    }

    if (!newTeam) {
      throw new AppError('Failed to join queue', 500, 'QUEUE_JOIN_FAILED');
    }

    // Emit queue update to all connected clients
    const updatedQueueState = await queueStateRepository.get();
    emitQueueUpdate({
      teams: updatedQueueState.teams,
      totalTeams: updatedQueueState.teams.length,
      availableSlots: updatedQueueState.maxSize - updatedQueueState.teams.length,
      event: 'team_joined'
    });
    
    res.status(201).json({
      success: true,
      data: {
        team: newTeam,
        position: nextPosition,
        estimatedWaitTime: `${(nextPosition - 1) * 15} minutes` // Rough estimate
      },
      message: `Team "${name}" successfully joined the queue at position ${nextPosition}`
    });
  })
);

// DELETE /api/queue/leave/:teamId - Leave the queue
router.delete('/leave/:teamId', asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  
  // Find the team
  const team = await teamRepository.findById(teamId);
  if (!team) {
    throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
  }
  
  // Check if team is in waiting status
  if (team.status !== 'waiting') {
    throw new AppError('Team is not in queue', 400, 'TEAM_NOT_IN_QUEUE');
  }
  
  // Remove team from queue
  await teamRepository.delete(teamId);
  
  // Update positions of remaining teams
  const remainingTeams = await teamRepository.getQueuedTeams();
  const positionUpdates = remainingTeams
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((team, index) => ({ id: team.id, position: index + 1 }));
  
  await teamRepository.updatePositions(positionUpdates);
  
  // Emit queue update to all connected clients
  const updatedQueueState = await queueStateRepository.get();
  emitQueueUpdate({
    teams: updatedQueueState.teams,
    totalTeams: updatedQueueState.teams.length,
    availableSlots: updatedQueueState.maxSize - updatedQueueState.teams.length,
    event: 'team_left'
  });
  
  res.json({
    success: true,
    message: `Team "${team.name}" has left the queue`,
    data: {
      removedTeam: team,
      updatedQueue: updatedQueueState.teams
    }
  });
}));

// GET /api/queue/position/:teamId - Get team's position in queue
router.get('/position/:teamId', asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  
  const team = await teamRepository.findById(teamId);
  if (!team) {
    throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
  }
  
  if (team.status !== 'waiting') {
    throw new AppError('Team is not in queue', 400, 'TEAM_NOT_IN_QUEUE');
  }
  
  const queuedTeams = await teamRepository.getQueuedTeams();
  const teamsAhead = queuedTeams.filter(t => (t.position || 0) < (team.position || 0)).length;
  
  res.json({
    success: true,
    data: {
      team: {
        id: team.id,
        name: team.name,
        position: team.position
      },
      teamsAhead,
      estimatedWaitTime: `${teamsAhead * 15} minutes`
    }
  });
}));

export default router;