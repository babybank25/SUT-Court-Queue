import { Database } from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

class DatabaseMigrator {
  private db: Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
  }

  async initialize(): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));
    
    // Create migrations table if it doesn't exist
    await run(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async getAppliedMigrations(): Promise<number[]> {
    const all = promisify(this.db.all.bind(this.db));
    const rows = await all('SELECT version FROM migrations ORDER BY version');
    return rows.map((row: any) => row.version);
  }

  async applyMigration(migration: Migration): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));
    
    console.log(`Applying migration ${migration.version}: ${migration.name}`);
    
    // Execute migration
    await run(migration.up);
    
    // Record migration
    await run(
      'INSERT INTO migrations (version, name) VALUES (?, ?)',
      [migration.version, migration.name]
    );
    
    console.log(`Migration ${migration.version} applied successfully`);
  }

  async rollbackMigration(migration: Migration): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));
    
    console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
    
    // Execute rollback
    await run(migration.down);
    
    // Remove migration record
    await run('DELETE FROM migrations WHERE version = ?', [migration.version]);
    
    console.log(`Migration ${migration.version} rolled back successfully`);
  }

  async close(): Promise<void> {
    const close = promisify(this.db.close.bind(this.db));
    await close();
  }
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_initial_tables',
    up: `
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        members INTEGER NOT NULL,
        contact_info TEXT,
        status TEXT DEFAULT 'waiting',
        wins INTEGER DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        position INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        team1_id TEXT NOT NULL,
        team2_id TEXT NOT NULL,
        score1 INTEGER DEFAULT 0,
        score2 INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        target_score INTEGER DEFAULT 21,
        match_type TEXT DEFAULT 'regular',
        team1_confirmed BOOLEAN DEFAULT FALSE,
        team2_confirmed BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (team1_id) REFERENCES teams (id),
        FOREIGN KEY (team2_id) REFERENCES teams (id)
      );

      CREATE TABLE IF NOT EXISTS court_status (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        is_open BOOLEAN DEFAULT TRUE,
        mode TEXT DEFAULT 'regular',
        cooldown_end DATETIME,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT OR IGNORE INTO court_status (id, is_open, mode) VALUES (1, TRUE, 'regular');
    `,
    down: `
      DROP TABLE IF EXISTS matches;
      DROP TABLE IF EXISTS teams;
      DROP TABLE IF EXISTS court_status;
    `
  },
  {
    version: 2,
    name: 'add_indexes_for_performance',
    up: `
      CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
      CREATE INDEX IF NOT EXISTS idx_teams_position ON teams(position);
      CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
      CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time);
    `,
    down: `
      DROP INDEX IF EXISTS idx_teams_status;
      DROP INDEX IF EXISTS idx_teams_position;
      DROP INDEX IF EXISTS idx_matches_status;
      DROP INDEX IF EXISTS idx_matches_start_time;
    `
  }
];

async function runMigrations(): Promise<void> {
  const dbPath = process.env.DATABASE_URL || './database.sqlite';
  const migrator = new DatabaseMigrator(dbPath);

  try {
    await migrator.initialize();
    const appliedMigrations = await migrator.getAppliedMigrations();
    
    console.log('Applied migrations:', appliedMigrations);
    
    for (const migration of migrations) {
      if (!appliedMigrations.includes(migration.version)) {
        await migrator.applyMigration(migration);
      } else {
        console.log(`Migration ${migration.version} already applied, skipping`);
      }
    }
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrator.close();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export { DatabaseMigrator, runMigrations };