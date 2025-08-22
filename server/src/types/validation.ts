import { z } from 'zod';

// Team validation schema
export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  members: z.number().int().min(1).max(10),
  contactInfo: z.string().optional(),
  status: z.enum(['waiting', 'playing', 'cooldown']),
  wins: z.number().int().min(0),
  lastSeen: z.date(),
  position: z.number().int().min(1).optional(),
});

// Match validation schema
export const MatchSchema = z.object({
  id: z.string().uuid(),
  team1: TeamSchema,
  team2: TeamSchema,
  score1: z.number().int().min(0),
  score2: z.number().int().min(0),
  status: z.enum(['active', 'confirming', 'completed']),
  startTime: z.date(),
  endTime: z.date().optional(),
  targetScore: z.number().int().min(1),
  matchType: z.enum(['champion-return', 'regular']),
  confirmed: z.object({
    team1: z.boolean(),
    team2: z.boolean(),
  }),
});

// Court Status validation schema
export const CourtStatusSchema = z.object({
  isOpen: z.boolean(),
  currentTime: z.date(),
  timezone: z.string(),
  mode: z.enum(['champion-return', 'regular']),
  cooldownEnd: z.date().optional(),
  rateLimit: z.object({
    current: z.number().int().min(0),
    max: z.number().int().min(1),
    window: z.string(),
  }),
});

// Queue State validation schema
export const QueueStateSchema = z.object({
  teams: z.array(TeamSchema),
  maxSize: z.number().int().min(1),
  currentMatch: MatchSchema.optional(),
  lastUpdated: z.date(),
});

// Input validation schemas for API endpoints
export const JoinQueueInputSchema = z.object({
  name: z.string().min(1).max(50),
  members: z.number().int().min(1).max(10),
  contactInfo: z.string().optional(),
});

export const ConfirmMatchInputSchema = z.object({
  matchId: z.string().uuid(),
  teamId: z.string().uuid(),
  confirmed: z.boolean(),
});

export const StartMatchInputSchema = z.object({
  team1Id: z.string().uuid(),
  team2Id: z.string().uuid(),
  targetScore: z.number().int().min(1).default(21),
  matchType: z.enum(['champion-return', 'regular']).default('regular'),
});

export const UpdateMatchInputSchema = z.object({
  score1: z.number().int().min(0).optional(),
  score2: z.number().int().min(0).optional(),
  status: z.enum(['active', 'confirming', 'completed']).optional(),
});

// Type inference from schemas
export type TeamInput = z.infer<typeof TeamSchema>;
export type MatchInput = z.infer<typeof MatchSchema>;
export type CourtStatusInput = z.infer<typeof CourtStatusSchema>;
export type QueueStateInput = z.infer<typeof QueueStateSchema>;
export type JoinQueueInput = z.infer<typeof JoinQueueInputSchema>;
export type ConfirmMatchInput = z.infer<typeof ConfirmMatchInputSchema>;
export type StartMatchInput = z.infer<typeof StartMatchInputSchema>;
export type UpdateMatchInput = z.infer<typeof UpdateMatchInputSchema>;