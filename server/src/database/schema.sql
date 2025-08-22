-- SUT Court Queue Database Schema
-- SQLite database schema for the court queue management system

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    members INTEGER NOT NULL CHECK (members > 0 AND members <= 10),
    contact_info TEXT,
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'cooldown')) DEFAULT 'waiting',
    wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    position INTEGER UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    team1_id TEXT NOT NULL,
    team2_id TEXT NOT NULL,
    score1 INTEGER NOT NULL DEFAULT 0 CHECK (score1 >= 0),
    score2 INTEGER NOT NULL DEFAULT 0 CHECK (score2 >= 0),
    status TEXT NOT NULL CHECK (status IN ('active', 'confirming', 'completed')) DEFAULT 'active',
    start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    target_score INTEGER NOT NULL DEFAULT 21 CHECK (target_score > 0),
    match_type TEXT NOT NULL CHECK (match_type IN ('champion-return', 'regular')) DEFAULT 'regular',
    team1_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    team2_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Court status table (single row configuration)
CREATE TABLE IF NOT EXISTS court_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    mode TEXT NOT NULL CHECK (mode IN ('champion-return', 'regular')) DEFAULT 'regular',
    cooldown_end DATETIME,
    rate_limit_current INTEGER NOT NULL DEFAULT 0 CHECK (rate_limit_current >= 0),
    rate_limit_max INTEGER NOT NULL DEFAULT 100 CHECK (rate_limit_max > 0),
    rate_limit_window TEXT NOT NULL DEFAULT '1h',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Queue state table (single row configuration)
CREATE TABLE IF NOT EXISTS queue_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    max_size INTEGER NOT NULL DEFAULT 20 CHECK (max_size > 0),
    current_match_id TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (current_match_id) REFERENCES matches(id) ON DELETE SET NULL
);

-- Match events table for tracking match history
CREATE TABLE IF NOT EXISTS match_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('score_update', 'status_change', 'confirmation', 'timeout')),
    event_data TEXT, -- JSON data for event details
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_position ON teams(position);
CREATE INDEX IF NOT EXISTS idx_teams_last_seen ON teams(last_seen);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time);
CREATE INDEX IF NOT EXISTS idx_matches_team1 ON matches(team1_id);
CREATE INDEX IF NOT EXISTS idx_matches_team2 ON matches(team2_id);
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_created_at ON match_events(created_at);

-- Triggers for updating timestamps
CREATE TRIGGER IF NOT EXISTS update_teams_timestamp 
    AFTER UPDATE ON teams
    BEGIN
        UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_matches_timestamp 
    AFTER UPDATE ON matches
    BEGIN
        UPDATE matches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_court_status_timestamp 
    AFTER UPDATE ON court_status
    BEGIN
        UPDATE court_status SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_queue_state_timestamp 
    AFTER UPDATE ON queue_state
    BEGIN
        UPDATE queue_state SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Insert default court status and queue state
INSERT OR IGNORE INTO court_status (id, is_open, timezone, mode) VALUES (1, TRUE, 'Asia/Bangkok', 'regular');
INSERT OR IGNORE INTO queue_state (id, max_size) VALUES (1, 20);