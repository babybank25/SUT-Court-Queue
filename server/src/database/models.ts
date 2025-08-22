import { database } from './connection';
import { Team, Match, CourtStatus, QueueState } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Database row interfaces (snake_case from database)
interface TeamRow {
  id: string;
  name: string;
  members: number;
  contact_info?: string;
  status: 'waiting' | 'playing' | 'cooldown';
  wins: number;
  last_seen: string;
  position?: number;
  created_at: string;
  updated_at: string;
}

interface MatchRow {
  id: string;
  team1_id: string;
  team2_id: string;
  score1: number;
  score2: number;
  status: 'active' | 'confirming' | 'completed';
  start_time: string;
  end_time?: string;
  target_score: number;
  match_type: 'champion-return' | 'regular';
  team1_confirmed: boolean;
  team2_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

interface CourtStatusRow {
  id: number;
  is_open: boolean;
  timezone: string;
  mode: 'champion-return' | 'regular';
  cooldown_end?: string;
  rate_limit_current: number;
  rate_limit_max: number;
  rate_limit_window: string;
  updated_at: string;
}

interface QueueStateRow {
  id: number;
  max_size: number;
  current_match_id?: string;
  updated_at: string;
}

// Utility functions for data transformation
function rowToTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    members: row.members,
    contactInfo: row.contact_info,
    status: row.status,
    wins: row.wins,
    lastSeen: new Date(row.last_seen),
    position: row.position,
  };
}

function teamToRow(team: Partial<Team>): Partial<TeamRow> {
  return {
    id: team.id,
    name: team.name,
    members: team.members,
    contact_info: team.contactInfo,
    status: team.status,
    wins: team.wins,
    last_seen: team.lastSeen?.toISOString(),
    position: team.position,
  };
}

function rowToMatch(row: MatchRow, team1: Team, team2: Team): Match {
  return {
    id: row.id,
    team1,
    team2,
    score1: row.score1,
    score2: row.score2,
    status: row.status,
    startTime: new Date(row.start_time),
    endTime: row.end_time ? new Date(row.end_time) : undefined,
    targetScore: row.target_score,
    matchType: row.match_type,
    confirmed: {
      team1: row.team1_confirmed,
      team2: row.team2_confirmed,
    },
  };
}

function rowToCourtStatus(row: CourtStatusRow): CourtStatus {
  return {
    isOpen: row.is_open,
    currentTime: new Date(),
    timezone: row.timezone,
    mode: row.mode,
    cooldownEnd: row.cooldown_end ? new Date(row.cooldown_end) : undefined,
    rateLimit: {
      current: row.rate_limit_current,
      max: row.rate_limit_max,
      window: row.rate_limit_window,
    },
  };
}

// Team repository
export class TeamRepository {
  async create(teamData: Omit<Team, 'id' | 'lastSeen'>): Promise<Team> {
    const id = uuidv4();
    const team: Team = {
      ...teamData,
      id,
      lastSeen: new Date(),
    };

    const row = teamToRow(team);
    await database.run(
      `INSERT INTO teams (id, name, members, contact_info, status, wins, last_seen, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.members, row.contact_info, row.status, row.wins, row.last_seen, row.position]
    );

    return team;
  }

  async findById(id: string): Promise<Team | null> {
    const row = await database.get<TeamRow>('SELECT * FROM teams WHERE id = ?', [id]);
    return row ? rowToTeam(row) : null;
  }

  async findByName(name: string): Promise<Team | null> {
    const row = await database.get<TeamRow>('SELECT * FROM teams WHERE name = ?', [name]);
    return row ? rowToTeam(row) : null;
  }

  async findAll(filters?: { status?: string; limit?: number; offset?: number }): Promise<Team[]> {
    let sql = 'SELECT * FROM teams';
    const params: any[] = [];

    if (filters?.status) {
      sql += ' WHERE status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY position ASC, created_at ASC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const rows = await database.all<TeamRow>(sql, params);
    return rows.map(rowToTeam);
  }

  async update(id: string, updates: Partial<Team>): Promise<Team | null> {
    const updateFields: string[] = [];
    const params: any[] = [];

    Object.entries(teamToRow(updates)).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        updateFields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    await database.run(
      `UPDATE teams SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await database.run('DELETE FROM teams WHERE id = ?', [id]);
    return result.changes! > 0;
  }

  async getQueuedTeams(): Promise<Team[]> {
    const rows = await database.all<TeamRow>(
      'SELECT * FROM teams WHERE status = ? ORDER BY position ASC',
      ['waiting']
    );
    return rows.map(rowToTeam);
  }

  async updatePositions(teamPositions: { id: string; position: number }[]): Promise<void> {
    await database.transaction(async () => {
      for (const { id, position } of teamPositions) {
        await database.run('UPDATE teams SET position = ? WHERE id = ?', [position, id]);
      }
    });
  }
}

// Match repository
export class MatchRepository {
  async create(matchData: Omit<Match, 'id' | 'startTime'>): Promise<Match> {
    const id = uuidv4();
    const match: Match = {
      ...matchData,
      id,
      startTime: new Date(),
    };

    await database.run(
      `INSERT INTO matches (id, team1_id, team2_id, score1, score2, status, start_time, end_time, target_score, match_type, team1_confirmed, team2_confirmed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        match.id,
        match.team1.id,
        match.team2.id,
        match.score1,
        match.score2,
        match.status,
        match.startTime.toISOString(),
        match.endTime?.toISOString(),
        match.targetScore,
        match.matchType,
        match.confirmed.team1,
        match.confirmed.team2,
      ]
    );

    return match;
  }

  async findById(id: string): Promise<Match | null> {
    const row = await database.get<MatchRow>('SELECT * FROM matches WHERE id = ?', [id]);
    if (!row) return null;

    const teamRepo = new TeamRepository();
    const [team1, team2] = await Promise.all([
      teamRepo.findById(row.team1_id),
      teamRepo.findById(row.team2_id),
    ]);

    if (!team1 || !team2) return null;

    return rowToMatch(row, team1, team2);
  }

  async findActive(): Promise<Match[]> {
    const rows = await database.all<MatchRow>('SELECT * FROM matches WHERE status = ?', ['active']);
    const teamRepo = new TeamRepository();
    
    const matches: Match[] = [];
    for (const row of rows) {
      const [team1, team2] = await Promise.all([
        teamRepo.findById(row.team1_id),
        teamRepo.findById(row.team2_id),
      ]);
      
      if (team1 && team2) {
        matches.push(rowToMatch(row, team1, team2));
      }
    }
    
    return matches;
  }

  async update(id: string, updates: Partial<Match>): Promise<Match | null> {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.score1 !== undefined) {
      updateFields.push('score1 = ?');
      params.push(updates.score1);
    }
    if (updates.score2 !== undefined) {
      updateFields.push('score2 = ?');
      params.push(updates.score2);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.endTime !== undefined) {
      updateFields.push('end_time = ?');
      params.push(updates.endTime.toISOString());
    }
    if (updates.confirmed !== undefined) {
      updateFields.push('team1_confirmed = ?', 'team2_confirmed = ?');
      params.push(updates.confirmed.team1, updates.confirmed.team2);
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    await database.run(
      `UPDATE matches SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    return this.findById(id);
  }
}

// Court Status repository
export class CourtStatusRepository {
  async get(): Promise<CourtStatus> {
    const row = await database.get<CourtStatusRow>('SELECT * FROM court_status WHERE id = 1');
    if (!row) {
      throw new Error('Court status not initialized');
    }
    return rowToCourtStatus(row);
  }

  async update(updates: Partial<CourtStatus>): Promise<CourtStatus> {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.isOpen !== undefined) {
      updateFields.push('is_open = ?');
      params.push(updates.isOpen);
    }
    if (updates.mode !== undefined) {
      updateFields.push('mode = ?');
      params.push(updates.mode);
    }
    if (updates.cooldownEnd !== undefined) {
      updateFields.push('cooldown_end = ?');
      params.push(updates.cooldownEnd.toISOString());
    }
    if (updates.rateLimit !== undefined) {
      updateFields.push('rate_limit_current = ?', 'rate_limit_max = ?', 'rate_limit_window = ?');
      params.push(updates.rateLimit.current, updates.rateLimit.max, updates.rateLimit.window);
    }

    if (updateFields.length > 0) {
      await database.run(
        `UPDATE court_status SET ${updateFields.join(', ')} WHERE id = 1`,
        params
      );
    }

    return this.get();
  }
}

// Queue State repository
export class QueueStateRepository {
  async get(): Promise<QueueState> {
    const row = await database.get<QueueStateRow>('SELECT * FROM queue_state WHERE id = 1');
    if (!row) {
      throw new Error('Queue state not initialized');
    }

    const teamRepo = new TeamRepository();
    const teams = await teamRepo.getQueuedTeams();

    let currentMatch: Match | undefined;
    if (row.current_match_id) {
      const matchRepo = new MatchRepository();
      currentMatch = await matchRepo.findById(row.current_match_id) || undefined;
    }

    return {
      teams,
      maxSize: row.max_size,
      currentMatch,
      lastUpdated: new Date(row.updated_at),
    };
  }

  async update(updates: Partial<QueueState>): Promise<QueueState> {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.maxSize !== undefined) {
      updateFields.push('max_size = ?');
      params.push(updates.maxSize);
    }
    if (updates.currentMatch !== undefined) {
      updateFields.push('current_match_id = ?');
      params.push(updates.currentMatch?.id || null);
    }

    if (updateFields.length > 0) {
      await database.run(
        `UPDATE queue_state SET ${updateFields.join(', ')} WHERE id = 1`,
        params
      );
    }

    return this.get();
  }
}

// Export repository instances
export const teamRepository = new TeamRepository();
export const matchRepository = new MatchRepository();
export const courtStatusRepository = new CourtStatusRepository();
export const queueStateRepository = new QueueStateRepository();