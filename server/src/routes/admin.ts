import { Router } from 'express';
import { 
  teamRepository, 
  matchRepository, 
  queueStateRepository, 
  courtStatusRepository 
} from '../database';
import { 
  validateBody, 
  asyncHandler, 
  AppError, 
  authenticateToken, 
  requireAdmin, 
  generateToken, 
  validateAdminCredentials,
  AuthRequest 
} from '../middleware';
import { StartMatchInputSchema, UpdateMatchInputSchema } from '../types/validation';
import { emitMatchUpdate, emitQueueUpdate, emitCourtStatusUpdate } from '../services/socketService';
import { courtStatusService } from '../services/courtStatusService';
import { z } from 'zod';

const router = Router();

// Admin login schema
const AdminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

// Team update schema
const TeamUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  members: z.number().int().min(1).max(10).optional(),
  contactInfo: z.string().optional(),
  status: z.enum(['waiting', 'playing', 'cooldown']).optional(),
  wins: z.number().int().min(0).optional(),
  position: z.number().int().min(1).optional()
});

// Court status update schema
const CourtStatusUpdateSchema = z.object({
  isOpen: z.boolean().optional(),
  mode: z.enum(['champion-return', 'regular']).optional(),
  cooldownMinutes: z.number().int().min(0).max(60).optional()
});

// POST /api/admin/login - Admin authentication
router.post('/login', 
  validateBody(AdminLoginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    const admin = await validateAdminCredentials(username, password);
    if (!admin) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    
    const token = generateToken({
      id: admin.id,
      username: admin.username,
      isAdmin: true
    });
    
    res.json({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          lastLogin: admin.last_login
        }
      },
      message: 'Login successful'
    });
  })
);

// All routes below require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/dashboard - Get dashboard data
router.get('/dashboard', asyncHandler(async (req: AuthRequest, res) => {
  const [queueState, activeMatches, courtStatus] = await Promise.all([
    queueStateRepository.get(),
    matchRepository.findActive(),
    courtStatusRepository.get()
  ]);
  
  // Get team statistics
  const allTeams = await teamRepository.findAll();
  const teamStats = {
    total: allTeams.length,
    waiting: allTeams.filter(t => t.status === 'waiting').length,
    playing: allTeams.filter(t => t.status === 'playing').length,
    cooldown: allTeams.filter(t => t.status === 'cooldown').length
  };
  
  res.json({
    success: true,
    data: {
      queue: {
        teams: queueState.teams,
        totalTeams: queueState.teams.length,
        maxSize: queueState.maxSize,
        availableSlots: queueState.maxSize - queueState.teams.length
      },
      matches: {
        active: activeMatches,
        totalActive: activeMatches.length
      },
      court: {
        status: courtStatus.isOpen ? 'open' : 'closed',
        mode: courtStatus.mode,
        cooldownEnd: courtStatus.cooldownEnd
      },
      teams: teamStats,
      lastUpdated: new Date().toISOString()
    }
  });
}));

// POST /api/admin/match/start - Start a new match
router.post('/match/start',
  validateBody(StartMatchInputSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { team1Id, team2Id, targetScore, matchType } = req.body;
    
    // Validate teams exist and are available
    const [team1, team2] = await Promise.all([
      teamRepository.findById(team1Id),
      teamRepository.findById(team2Id)
    ]);
    
    if (!team1 || !team2) {
      throw new AppError('One or both teams not found', 404, 'TEAM_NOT_FOUND');
    }
    
    if (team1.status !== 'waiting' || team2.status !== 'waiting') {
      throw new AppError('Teams must be in waiting status to start match', 400, 'TEAM_NOT_AVAILABLE');
    }
    
    // Create new match
    const newMatch = await matchRepository.create({
      team1,
      team2,
      score1: 0,
      score2: 0,
      status: 'active',
      targetScore,
      matchType,
      confirmed: { team1: false, team2: false }
    });
    
    // Update team statuses to playing
    await Promise.all([
      teamRepository.update(team1Id, { status: 'playing' }),
      teamRepository.update(team2Id, { status: 'playing' })
    ]);
    
    // Update queue state with current match
    await queueStateRepository.update({ currentMatch: newMatch });
    
    // Emit updates
    emitMatchUpdate({
      match: newMatch,
      event: 'match_started',
      teams: `${team1.name} vs ${team2.name}`
    });
    
    const updatedQueueState = await queueStateRepository.get();
    emitQueueUpdate({
      teams: updatedQueueState.teams,
      totalTeams: updatedQueueState.teams.length,
      availableSlots: updatedQueueState.maxSize - updatedQueueState.teams.length,
      event: 'match_started',
      currentMatch: newMatch
    });
    
    res.status(201).json({
      success: true,
      data: {
        match: newMatch,
        message: `Match started: ${team1.name} vs ${team2.name}`
      }
    });
  })
);

// PUT /api/admin/match/:id - Update match details
router.put('/match/:id',
  validateBody(UpdateMatchInputSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const match = await matchRepository.findById(id);
    if (!match) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }
    
    const updatedMatch = await matchRepository.update(id, updates);
    
    emitMatchUpdate({
      match: updatedMatch,
      event: 'match_updated_by_admin',
      updatedBy: req.user?.username
    });
    
    res.json({
      success: true,
      data: {
        match: updatedMatch
      },
      message: 'Match updated successfully'
    });
  })
);

// POST /api/admin/match/:id/force-resolve - Force resolve match
router.post('/match/:id/force-resolve', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const match = await matchRepository.findById(id);
  if (!match) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }
  
  if (match.status === 'completed') {
    throw new AppError('Match is already completed', 400, 'MATCH_ALREADY_COMPLETED');
  }
  
  // Force complete the match
  const updatedMatch = await matchRepository.update(id, {
    status: 'completed',
    endTime: new Date(),
    confirmed: { team1: true, team2: true }
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
    event: 'match_force_resolved',
    resolvedBy: req.user?.username,
    winner: winner.name,
    finalScore: `${match.score1}-${match.score2}`
  });
  
  res.json({
    success: true,
    data: {
      match: updatedMatch,
      winner: winner.name,
      finalScore: `${match.score1}-${match.score2}`,
      resolvedBy: req.user?.username
    },
    message: 'Match force resolved successfully'
  });
}));

// GET /api/admin/teams - Get all teams with pagination
router.get('/teams', asyncHandler(async (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const offset = (page - 1) * limit;
  
  const filters: any = {};
  if (status) filters.status = status;
  
  const teams = await teamRepository.findAll({ ...filters, limit, offset });
  const totalTeams = await teamRepository.findAll(filters);
  
  res.json({
    success: true,
    data: {
      teams,
      pagination: {
        page,
        limit,
        total: totalTeams.length,
        totalPages: Math.ceil(totalTeams.length / limit)
      }
    }
  });
}));

// PUT /api/admin/teams/:id - Update team
router.put('/teams/:id',
  validateBody(TeamUpdateSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const team = await teamRepository.findById(id);
    if (!team) {
      throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
    }
    
    const updatedTeam = await teamRepository.update(id, updates);
    
    const updatedQueueState = await queueStateRepository.get();
    emitQueueUpdate({
      teams: updatedQueueState.teams,
      totalTeams: updatedQueueState.teams.length,
      availableSlots: updatedQueueState.maxSize - updatedQueueState.teams.length,
      event: 'team_updated_by_admin',
      updatedTeam,
      updatedBy: req.user?.username
    });
    
    res.json({
      success: true,
      data: {
        team: updatedTeam
      },
      message: 'Team updated successfully'
    });
  })
);

// DELETE /api/admin/teams/:id - Delete team
router.delete('/teams/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const team = await teamRepository.findById(id);
  if (!team) {
    throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
  }
  
  // Check if team is currently playing
  if (team.status === 'playing') {
    throw new AppError('Cannot delete team that is currently playing', 400, 'TEAM_CURRENTLY_PLAYING');
  }
  
  await teamRepository.delete(id);
  
  // Update positions of remaining teams if deleted team was in queue
  if (team.status === 'waiting') {
    const remainingTeams = await teamRepository.getQueuedTeams();
    const positionUpdates = remainingTeams
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((team, index) => ({ id: team.id, position: index + 1 }));
    
    await teamRepository.updatePositions(positionUpdates);
  }
  
  const finalQueueState = await queueStateRepository.get();
  emitQueueUpdate({
    teams: finalQueueState.teams,
    totalTeams: finalQueueState.teams.length,
    availableSlots: finalQueueState.maxSize - finalQueueState.teams.length,
    event: 'team_deleted_by_admin',
    deletedTeam: team,
    deletedBy: req.user?.username
  });
  
  res.json({
    success: true,
    message: `Team "${team.name}" deleted successfully`
  });
}));

// PUT /api/admin/queue/reorder - Reorder queue positions
router.put('/queue/reorder', asyncHandler(async (req: AuthRequest, res) => {
  const { teamPositions } = req.body;
  
  if (!Array.isArray(teamPositions)) {
    throw new AppError('teamPositions must be an array', 400, 'INVALID_INPUT');
  }
  
  // Validate all teams exist and are in waiting status
  for (const { id } of teamPositions) {
    const team = await teamRepository.findById(id);
    if (!team || team.status !== 'waiting') {
      throw new AppError(`Team ${id} not found or not in queue`, 400, 'INVALID_TEAM');
    }
  }
  
  await teamRepository.updatePositions(teamPositions);
  
  const updatedQueueState = await queueStateRepository.get();
  
  emitQueueUpdate({
    teams: updatedQueueState.teams,
    totalTeams: updatedQueueState.teams.length,
    availableSlots: updatedQueueState.maxSize - updatedQueueState.teams.length,
    event: 'queue_reordered_by_admin',
    reorderedBy: req.user?.username
  });
  
  res.json({
    success: true,
    data: {
      queue: updatedQueueState.teams
    },
    message: 'Queue reordered successfully'
  });
}));

// PUT /api/admin/court/status - Update court status
router.put('/court/status',
  validateBody(CourtStatusUpdateSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { isOpen, mode, cooldownMinutes } = req.body;
    
    const updates: any = {};
    if (typeof isOpen === 'boolean') updates.isOpen = isOpen;
    if (mode) updates.mode = mode;
    
    // Handle cooldown for champion-return mode
    if (mode === 'champion-return' && cooldownMinutes) {
      const cooldownEnd = new Date();
      cooldownEnd.setMinutes(cooldownEnd.getMinutes() + cooldownMinutes);
      updates.cooldownEnd = cooldownEnd;
    } else if (mode === 'regular') {
      updates.cooldownEnd = null;
    }
    
    await courtStatusService.updateStatus(updates);
    
    res.json({
      success: true,
      message: 'Court status updated successfully',
      data: { updates }
    });
  })
);

// POST /api/admin/court/champion-mode - Set champion return mode
router.post('/court/champion-mode', asyncHandler(async (req: AuthRequest, res) => {
  const { cooldownMinutes = 15 } = req.body;
  
  await courtStatusService.setChampionReturnMode(cooldownMinutes);
  
  res.json({
    success: true,
    message: `Champion return mode activated with ${cooldownMinutes} minute cooldown`
  });
}));

// POST /api/admin/court/regular-mode - Set regular mode
router.post('/court/regular-mode', asyncHandler(async (req: AuthRequest, res) => {
  await courtStatusService.setRegularMode();
  
  res.json({
    success: true,
    message: 'Regular mode activated'
  });
}));

// POST /api/admin/court/open - Open court
router.post('/court/open', asyncHandler(async (req: AuthRequest, res) => {
  await courtStatusService.openCourt();
  
  res.json({
    success: true,
    message: 'Court opened'
  });
}));

// POST /api/admin/court/close - Close court
router.post('/court/close', asyncHandler(async (req: AuthRequest, res) => {
  await courtStatusService.closeCourt();
  
  res.json({
    success: true,
    message: 'Court closed'
  });
}));

export default router;