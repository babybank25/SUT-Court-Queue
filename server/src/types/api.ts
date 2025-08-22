import { Team, Match, CourtStatus, QueueState } from './index';

// Generic API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

// Success response helper type
export interface SuccessResponse<T = any> extends ApiResponse<T> {
  success: true;
  data: T;
}

// Error response helper type
export interface ErrorResponse extends ApiResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Specific API response types
export interface QueueResponse extends SuccessResponse<QueueState> {}

export interface TeamResponse extends SuccessResponse<Team> {}

export interface MatchResponse extends SuccessResponse<Match> {}

export interface CourtStatusResponse extends SuccessResponse<CourtStatus> {}

export interface JoinQueueResponse extends SuccessResponse<{
  team: Team;
  position: number;
  message: string;
}> {}

export interface ConfirmMatchResponse extends SuccessResponse<{
  match: Match;
  confirmed: boolean;
  waitingFor?: string;
  message: string;
}> {}

export interface AdminDashboardResponse extends SuccessResponse<{
  activeMatches: Match[];
  queueState: QueueState;
  courtStatus: CourtStatus;
  stats: {
    totalTeams: number;
    activeTeams: number;
    completedMatches: number;
    averageMatchDuration: number;
  };
}> {}

export interface TeamsListResponse extends SuccessResponse<{
  teams: Team[];
  total: number;
  page: number;
  limit: number;
}> {}

// WebSocket event types
export interface WebSocketEvent<T = any> {
  type: string;
  data: T;
  timestamp: Date;
}

export interface QueueUpdatedEvent extends WebSocketEvent<QueueState> {
  type: 'queue-updated';
}

export interface MatchUpdatedEvent extends WebSocketEvent<Match> {
  type: 'match-updated';
}

export interface CourtStatusEvent extends WebSocketEvent<CourtStatus> {
  type: 'court-status';
}

export interface NotificationEvent extends WebSocketEvent<{
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  targetTeam?: string;
}> {
  type: 'notification';
}

// Error codes enum
export enum ErrorCode {
  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Queue errors
  QUEUE_FULL = 'QUEUE_FULL',
  TEAM_ALREADY_IN_QUEUE = 'TEAM_ALREADY_IN_QUEUE',
  TEAM_NOT_IN_QUEUE = 'TEAM_NOT_IN_QUEUE',
  
  // Match errors
  MATCH_NOT_FOUND = 'MATCH_NOT_FOUND',
  MATCH_ALREADY_CONFIRMED = 'MATCH_ALREADY_CONFIRMED',
  MATCH_NOT_ACTIVE = 'MATCH_NOT_ACTIVE',
  INSUFFICIENT_TEAMS = 'INSUFFICIENT_TEAMS',
  
  // Team errors
  TEAM_NOT_FOUND = 'TEAM_NOT_FOUND',
  TEAM_ALREADY_EXISTS = 'TEAM_ALREADY_EXISTS',
  TEAM_IN_COOLDOWN = 'TEAM_IN_COOLDOWN',
  
  // Court errors
  COURT_CLOSED = 'COURT_CLOSED',
  COURT_OCCUPIED = 'COURT_OCCUPIED',
  
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

// Pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Filter parameters for teams
export interface TeamFilters {
  status?: 'waiting' | 'playing' | 'cooldown';
  minWins?: number;
  maxWins?: number;
  search?: string;
}

// Request context for middleware
export interface RequestContext {
  userId?: string;
  isAdmin?: boolean;
  rateLimit?: {
    remaining: number;
    resetTime: Date;
  };
}