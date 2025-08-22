import { database } from './connection';
import { MatchEvent, MatchEventRow } from '../types/matchEvents';

export class MatchEventsRepository {
  async create(eventData: Omit<MatchEvent, 'id' | 'createdAt'>): Promise<MatchEvent> {
    const result = await database.run(
      `INSERT INTO match_events (match_id, event_type, event_data)
       VALUES (?, ?, ?)`,
      [
        eventData.matchId,
        eventData.eventType,
        JSON.stringify(eventData.eventData)
      ]
    );

    const id = result.lastID!;
    return this.findById(id)!;
  }

  async findById(id: number): Promise<MatchEvent | null> {
    const row = await database.get<MatchEventRow>(
      'SELECT * FROM match_events WHERE id = ?',
      [id]
    );
    
    return row ? this.rowToMatchEvent(row) : null;
  }

  async findByMatchId(matchId: string, limit: number = 50): Promise<MatchEvent[]> {
    const rows = await database.all<MatchEventRow>(
      'SELECT * FROM match_events WHERE match_id = ? ORDER BY created_at DESC LIMIT ?',
      [matchId, limit]
    );
    
    return rows.map(row => this.rowToMatchEvent(row));
  }

  async findRecent(limit: number = 20): Promise<MatchEvent[]> {
    const rows = await database.all<MatchEventRow>(
      'SELECT * FROM match_events ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    
    return rows.map(row => this.rowToMatchEvent(row));
  }

  private rowToMatchEvent(row: MatchEventRow): MatchEvent {
    return {
      id: row.id,
      matchId: row.match_id,
      eventType: row.event_type,
      eventData: JSON.parse(row.event_data),
      createdAt: new Date(row.created_at)
    };
  }

  async deleteByMatchId(matchId: string): Promise<void> {
    await database.run('DELETE FROM match_events WHERE match_id = ?', [matchId]);
  }
}

export const matchEventsRepository = new MatchEventsRepository();