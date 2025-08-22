import {
  TeamSchema,
  MatchSchema,
  CourtStatusSchema,
  QueueStateSchema,
  JoinQueueInputSchema,
  ConfirmMatchInputSchema,
} from '../validation';

describe('Validation Schemas', () => {
  describe('TeamSchema', () => {
    it('should validate a valid team object', () => {
      const validTeam = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Team',
        members: 5,
        contactInfo: 'test@example.com',
        status: 'waiting' as const,
        wins: 3,
        lastSeen: new Date(),
        position: 1,
      };

      const result = TeamSchema.safeParse(validTeam);
      expect(result.success).toBe(true);
    });

    it('should reject invalid team data', () => {
      const invalidTeam = {
        id: 'invalid-uuid',
        name: '', // Empty name should fail
        members: -1, // Negative members should fail
        status: 'invalid-status',
        wins: -5, // Negative wins should fail
        lastSeen: 'not-a-date',
      };

      const result = TeamSchema.safeParse(invalidTeam);
      expect(result.success).toBe(false);
    });
  });

  describe('JoinQueueInputSchema', () => {
    it('should validate valid join queue input', () => {
      const validInput = {
        name: 'New Team',
        members: 4,
        contactInfo: 'contact@example.com',
      };

      const result = JoinQueueInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid join queue input', () => {
      const invalidInput = {
        name: '', // Empty name
        members: 0, // Invalid member count
      };

      const result = JoinQueueInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should allow optional contactInfo', () => {
      const validInput = {
        name: 'Team Without Contact',
        members: 3,
      };

      const result = JoinQueueInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('ConfirmMatchInputSchema', () => {
    it('should validate valid confirmation input', () => {
      const validInput = {
        matchId: '123e4567-e89b-12d3-a456-426614174000',
        teamId: '123e4567-e89b-12d3-a456-426614174001',
        confirmed: true,
      };

      const result = ConfirmMatchInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      const invalidInput = {
        matchId: 'not-a-uuid',
        teamId: 'also-not-a-uuid',
        confirmed: true,
      };

      const result = ConfirmMatchInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('CourtStatusSchema', () => {
    it('should validate valid court status', () => {
      const validStatus = {
        isOpen: true,
        currentTime: new Date(),
        timezone: 'Asia/Bangkok',
        mode: 'regular' as const,
        cooldownEnd: new Date(),
        rateLimit: {
          current: 5,
          max: 100,
          window: '1h',
        },
      };

      const result = CourtStatusSchema.safeParse(validStatus);
      expect(result.success).toBe(true);
    });
  });

  describe('QueueStateSchema', () => {
    it('should validate valid queue state', () => {
      const validQueueState = {
        teams: [],
        maxSize: 20,
        lastUpdated: new Date(),
      };

      const result = QueueStateSchema.safeParse(validQueueState);
      expect(result.success).toBe(true);
    });

    it('should reject invalid max size', () => {
      const invalidQueueState = {
        teams: [],
        maxSize: 0, // Should be at least 1
        lastUpdated: new Date(),
      };

      const result = QueueStateSchema.safeParse(invalidQueueState);
      expect(result.success).toBe(false);
    });
  });
});