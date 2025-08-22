import { Router, Request, Response } from 'express';
import { matchRepository, teamRepository, queueStateRepository } from '../database';
import { matchEventsRepository } from '../database/matchEventsRepository';
import { validateBody, asyncHandler, AppError } from '../middleware';
import { ConfirmMatchInputSchema, UpdateMatchInput } from '../types/validation';
import { emitMatchUpdate, emitQueueUpdate } from '../services/socketService';
import { matchTimeoutService } from '../services/matchTimeoutService';

const router = Router();

// GET /api/match/current - Get current active matches
router.get('/current', asyncHandler(async (req: Request, res: Response) => {
  const activeMatches = await matchRepository.findActive();
  
  res.json({
    success: true,
    data: {
      matches: activeMatches,
      totalActiveMatches: activeMatches.length,
      hasActiveMatch: activeMatches.length > 0
    }
  });
}));

// GET /api/match/:id - Get specific match details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const match = await matchRepository.findById(id);
  if (!match) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }
  
  res.json({
    success: true,
    data: {
      match,
      duration: match.endTime 
        ? Math.floor((match.endTime.getTime() - match.startTime.getTime()) / 1000 / 60) 
        : Math.floor((new Date().getTime() - match.startTime.getTime()) / 1000 / 60),
      isComplete: match.status === 'completed',
      needsConfirmation: match.status === 'confirming'
    }
  });
}));

// GET /api/match/:id/events - Get match events/history
router.get('/:id/events', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  
  // Verify match exists
  const match = await matchRepository.findById(id);
  if (!match) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }
  
  const events = await matchEventsRepository.findByMatchId(id, limit);
  
  res.json({
    success: true,
    data: {
      events,
      matchId: id,
      totalEvents: events.length
    }
  });
}));

// POST /api/match/confirm - Confirm match result
router.post('/confirm', 
  validateBody(ConfirmMatchInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { matchId, teamId, confirmed } = req.body;
    
    // Find the match
    const match = await matchRepository.findById(matchId);
    if (!match) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }
    
    // Check if match is in confirming state
    if (match.status !== 'confirming') {
      throw new AppError('Match is not awaiting confirmation', 400, 'MATCH_NOT_CONFIRMING');
    }
    
    // Verify team is part of this match
    if (teamId !== match.team1.id && teamId !== match.team2.id) {
      throw new AppError('Team is not part of this match', 400, 'TEAM_NOT_IN_MATCH');
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
    
    if (!updatedMatch) {
      throw new AppError('Failed to update match', 500, 'MATCH_UPDATE_FAILED');
    }
    
    // Create confirmation event
    const confirmingTeam = teamId === match.team1.id ? match.team1 : match.team2;
    await matchEventsRepository.create({
      matchId,
      eventType: 'confirmation',
      eventData: {
        teamId,
        teamName: confirmingTeam.name,
        confirmed,
        bothConfirmed: updatedConfirmed.team1 && updatedConfirmed.team2
      }
    });
    
    // Check if both teams have confirmed
    if (updatedConfirmed.team1 && updatedConfirmed.team2) {
      // Clear any existing timeout since both teams confirmed
      matchTimeoutService.clearTimeout(matchId);
      
      // Both teams confirmed - complete the match
      const completedMatch = await matchRepository.update(matchId, {
        status: 'completed',
        endTime: new Date()
      });
      
      if (!completedMatch) {
        throw new AppError('Failed to complete match', 500, 'MATCH_COMPLETION_FAILED');
      }
      
      updatedMatch = completedMatch;
      
      // Create match completion event
      const winner = match.score1 > match.score2 ? match.team1 : match.team2;
      await matchEventsRepository.create({
        matchId,
        eventType: 'status_change',
        eventData: {
          status: 'completed',
          previousStatus: 'confirming',
          reason: 'both_teams_confirmed',
          winner: winner.name,
          finalScore: `${match.score1}-${match.score2}`,
          duration: Math.floor((new Date().getTime() - match.startTime.getTime()) / 1000 / 60)
        }
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
      
      res.json({
        success: true,
        data: {
          match: updatedMatch,
          winner: winner.name,
          finalScore: `${match.score1}-${match.score2}`
        },
        message: 'Match completed successfully'
      });
    } else {
      // Still waiting for other team's confirmation
      const waitingFor = updatedConfirmed.team1 ? match.team2.name : match.team1.name;
      
      emitMatchUpdate({
        match: updatedMatch,
        event: 'confirmation_received',
        waitingFor
      });
      
      res.json({
        success: true,
        data: {
          match: updatedMatch,
          waitingFor,
          confirmationStatus: updatedConfirmed
        },
        message: `Confirmation received. Waiting for ${waitingFor} to confirm.`
      });
    }
  })
);

// PUT /api/match/:id/score - Update match score (for live scoring)
router.put('/:id/score', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { score1, score2 } = req.body;
  
  // Validate scores
  if (typeof score1 !== 'number' || typeof score2 !== 'number' || score1 < 0 || score2 < 0) {
    throw new AppError('Invalid score values', 400, 'INVALID_SCORE');
  }
  
  const match = await matchRepository.findById(id);
  if (!match) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }
  
  if (match.status !== 'active') {
    throw new AppError('Cannot update score for inactive match', 400, 'MATCH_NOT_ACTIVE');
  }
  
  // Check if match should move to confirming state
  const shouldConfirm = score1 >= match.targetScore || score2 >= match.targetScore;
  const newStatus = shouldConfirm ? 'confirming' : 'active';
  
  const updatedMatch = await matchRepository.update(id, {
    score1,
    score2,
    status: newStatus
  });
  
  if (!updatedMatch) {
    throw new AppError('Failed to update match score', 500, 'MATCH_UPDATE_FAILED');
  }
  
  // Create match event for score update
  await matchEventsRepository.create({
    matchId: id,
    eventType: 'score_update',
    eventData: {
      score1,
      score2,
      previousScore1: match.score1,
      previousScore2: match.score2,
      team1Name: match.team1.name,
      team2Name: match.team2.name
    }
  });
  
  // Create status change event if match ended
  if (shouldConfirm) {
    await matchEventsRepository.create({
      matchId: id,
      eventType: 'status_change',
      eventData: {
        status: 'confirming',
        previousStatus: 'active',
        reason: 'target_score_reached',
        targetScore: match.targetScore
      }
    });
  }
  
  // Start confirmation timeout if match is now in confirming state
  if (shouldConfirm) {
    matchTimeoutService.startConfirmationTimeout(id);
  }
  
  // Emit real-time score update
  emitMatchUpdate({
    match: updatedMatch,
    event: shouldConfirm ? 'match_ended' : 'score_updated',
    score: `${score1}-${score2}`
  });
  
  res.json({
    success: true,
    data: {
      match: updatedMatch,
      scoreUpdate: `${score1}-${score2}`,
      needsConfirmation: shouldConfirm
    },
    message: shouldConfirm 
      ? 'Match ended. Waiting for team confirmations.' 
      : 'Score updated successfully'
  });
}));

// POST /api/match/:id/timeout - Handle confirmation timeout
router.post('/:id/timeout', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const match = await matchRepository.findById(id);
  if (!match) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }
  
  if (match.status !== 'confirming') {
    throw new AppError('Match is not awaiting confirmation', 400, 'MATCH_NOT_CONFIRMING');
  }
  
  // Auto-resolve with current scores
  const updatedMatch = await matchRepository.update(id, {
    status: 'completed',
    endTime: new Date(),
    confirmed: { team1: true, team2: true } // Force confirm both
  });
  
  if (!updatedMatch) {
    throw new AppError('Failed to resolve match timeout', 500, 'MATCH_TIMEOUT_FAILED');
  }
  
  // Create timeout event
  const winner = match.score1 > match.score2 ? match.team1 : match.team2;
  await matchEventsRepository.create({
    matchId: id,
    eventType: 'timeout',
    eventData: {
      reason: 'confirmation_timeout',
      winner: winner.name,
      finalScore: `${match.score1}-${match.score2}`,
      duration: Math.floor((new Date().getTime() - match.startTime.getTime()) / 1000 / 60),
      resolvedBy: 'system'
    }
  });
  
  // Update team statuses
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
  
  emitMatchUpdate({
    match: updatedMatch,
    event: 'match_timeout_resolved',
    winner: winner.name,
    finalScore: `${match.score1}-${match.score2}`
  });
  
  res.json({
    success: true,
    data: {
      match: updatedMatch,
      winner: winner.name,
      finalScore: `${match.score1}-${match.score2}`,
      resolvedBy: 'timeout'
    },
    message: 'Match resolved due to confirmation timeout'
  });
}));

export default router;