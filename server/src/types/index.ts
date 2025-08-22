export interface Team {
  id: string;
  name: string;
  members: number;
  contactInfo?: string;
  status: 'waiting' | 'playing' | 'cooldown';
  wins: number;
  lastSeen: Date;
  position?: number;
}

export interface Match {
  id: string;
  team1: Team;
  team2: Team;
  score1: number;
  score2: number;
  status: 'active' | 'confirming' | 'completed';
  startTime: Date;
  endTime?: Date;
  targetScore: number;
  matchType: 'champion-return' | 'regular';
  confirmed: {
    team1: boolean;
    team2: boolean;
  };
}

export interface CourtStatus {
  isOpen: boolean;
  currentTime: Date;
  timezone: string;
  mode: 'champion-return' | 'regular';
  cooldownEnd?: Date;
  rateLimit: {
    current: number;
    max: number;
    window: string;
  };
}

export interface QueueState {
  teams: Team[];
  maxSize: number;
  currentMatch?: Match;
  lastUpdated: Date;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

// WebSocket Event Types
export interface SocketEvents {
  // Client to Server events
  'join-queue': (data: { teamName: string; members: number; contactInfo?: string }) => void;
  'confirm-result': (data: { matchId: string; teamId: string; confirmed: boolean }) => void;
  'admin-action': (data: { action: string; payload: any; adminId: string }) => void;
  'join-room': (data: { room: string }) => void;
  'leave-room': (data: { room: string }) => void;
  
  // Server to Client events
  'queue-updated': (data: QueueUpdateData) => void;
  'match-updated': (data: MatchUpdateData) => void;
  'court-status': (data: CourtStatusData) => void;
  'notification': (data: NotificationData) => void;
  'error': (data: SocketErrorData) => void;
}

export interface QueueUpdateData {
  teams?: Team[];
  totalTeams?: number;
  availableSlots?: number;
  event?: string;
  completedMatch?: Match;
  currentMatch?: Match;
  updatedTeam?: Team;
  deletedTeam?: Team;
  updatedBy?: string;
  deletedBy?: string;
  reorderedBy?: string;
}

export interface MatchUpdateData {
  match: Match;
  event: 'score_updated' | 'match_ended' | 'match_completed' | 'confirmation_received' | 'match_timeout_resolved' | 'match_started' | 'match_updated_by_admin' | 'match_force_resolved';
  score?: string;
  winner?: string;
  finalScore?: string;
  waitingFor?: string;
  teams?: string;
  updatedBy?: string;
  resolvedBy?: string;
}

export interface CourtStatusData {
  isOpen: boolean;
  currentTime: string;
  timezone: string;
  mode: 'champion-return' | 'regular';
  cooldownEnd?: string;
  activeMatches: number;
}

export interface NotificationData {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  duration?: number;
}

export interface SocketErrorData {
  code: string;
  message: string;
  details?: any;
}

// Re-export validation schemas and API types
export * from './validation';
export * from './api';
export * from './matchEvents';