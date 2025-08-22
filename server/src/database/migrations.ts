import { database } from './connection';
import fs from 'fs';
import path from 'path';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

export class MigrationManager {
  private migrations: Migration[] = [];

  constructor() {
    this.loadMigrations();
  }

  private loadMigrations(): void {
    // Load the main schema as migration version 1
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    this.migrations.push({
      version: 1,
      name: 'initial_schema',
      up: schemaContent,
    });
  }

  public async initializeMigrationTable(): Promise<void> {
    const createMigrationTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await database.run(createMigrationTable);
  }

  public async getAppliedMigrations(): Promise<number[]> {
    try {
      const rows = await database.all<{ version: number }>('SELECT version FROM migrations ORDER BY version');
      return rows.map(row => row.version);
    } catch (error) {
      // If migrations table doesn't exist, return empty array
      return [];
    }
  }

  public async applyMigration(migration: Migration): Promise<void> {
    console.log(`Applying migration ${migration.version}: ${migration.name}`);
    
    await database.transaction(async () => {
      // Execute the migration SQL
      await database.exec(migration.up);
      
      // Record the migration as applied
      await database.run(
        'INSERT INTO migrations (version, name) VALUES (?, ?)',
        [migration.version, migration.name]
      );
    });
    
    console.log(`Migration ${migration.version} applied successfully`);
  }

  public async migrate(): Promise<void> {
    console.log('Starting database migration...');
    
    // Initialize migration table
    await this.initializeMigrationTable();
    
    // Get applied migrations
    const appliedMigrations = await this.getAppliedMigrations();
    
    // Apply pending migrations
    for (const migration of this.migrations) {
      if (!appliedMigrations.includes(migration.version)) {
        await this.applyMigration(migration);
      } else {
        console.log(`Migration ${migration.version} already applied, skipping`);
      }
    }
    
    console.log('Database migration completed');
  }

  public async rollback(targetVersion?: number): Promise<void> {
    const appliedMigrations = await this.getAppliedMigrations();
    const target = targetVersion || Math.max(...appliedMigrations) - 1;
    
    console.log(`Rolling back to version ${target}`);
    
    for (const version of appliedMigrations.reverse()) {
      if (version > target) {
        const migration = this.migrations.find(m => m.version === version);
        if (migration && migration.down) {
          console.log(`Rolling back migration ${version}: ${migration.name}`);
          
          await database.transaction(async () => {
            await database.exec(migration.down!);
            await database.run('DELETE FROM migrations WHERE version = ?', [version]);
          });
          
          console.log(`Migration ${version} rolled back successfully`);
        } else {
          console.warn(`No rollback script for migration ${version}`);
        }
      }
    }
    
    console.log('Rollback completed');
  }

  public async reset(): Promise<void> {
    console.log('Resetting database...');
    
    // Drop all tables
    const tables = await database.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    
    for (const table of tables) {
      await database.run(`DROP TABLE IF EXISTS ${table.name}`);
    }
    
    // Reapply all migrations
    await this.migrate();
    
    console.log('Database reset completed');
  }

  public async seed(): Promise<void> {
    console.log('Seeding database with initial data...');
    
    // Check if we already have data
    const teamCount = await database.get<{ count: number }>('SELECT COUNT(*) as count FROM teams');
    if (teamCount && teamCount.count > 0) {
      console.log('Database already has data, skipping seed');
      return;
    }
    
    // Insert sample admin user (password: admin123)
    const adminPasswordHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // bcrypt hash for 'admin123'
    
    await database.run(
      'INSERT OR IGNORE INTO admin_users (id, username, password_hash) VALUES (?, ?, ?)',
      ['admin-1', 'admin', adminPasswordHash]
    );
    
    console.log('Database seeded successfully');
  }
}

// Export singleton instance
export const migrationManager = new MigrationManager();