export interface MatchEvent {
  id: number;
  matchId: string;
  eventType: 'score_update' | 'status_change' | 'confirmation' | 'timeout';
  eventData: {
    score1?: number;
    score2?: number;
    previousScore1?: number;
    previousScore2?: number;
    status?: string;
    previousStatus?: string;
    teamId?: string;
    teamName?: string;
    confirmed?: boolean;
    timeoutReason?: string;
    adminId?: string;
    [key: string]: any;
  };
  createdAt: Date;
}

export interface MatchEventRow {
  id: number;
  match_id: string;
  event_type: 'score_update' | 'status_change' | 'confirmation' | 'timeout';
  event_data: string; // JSON string
  created_at: string;
}