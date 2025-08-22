import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

// Enable verbose mode for debugging in development
const sqlite = sqlite3.verbose();

export class Database {
  private db: sqlite3.Database | null = null;
  private static instance: Database;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(dbPath?: string): Promise<void> {
    const databasePath = dbPath || process.env.DATABASE_PATH || path.join(__dirname, '../../data/court_queue.db');
    
    // Ensure the data directory exists
    const dataDir = path.dirname(databasePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite.Database(databasePath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database:', databasePath);
          resolve();
        }
      });
    });
  }

  public async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
          reject(err);
        } else {
          console.log('Database connection closed');
          this.db = null;
          resolve();
        }
      });
    });
  }

  public getDb(): sqlite3.Database {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  // Promisified database methods
  public async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    if (!this.db) throw new Error('Database not connected');
    
    const runAsync = promisify(this.db.run.bind(this.db));
    return runAsync(sql, params);
  }

  public async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    if (!this.db) throw new Error('Database not connected');
    
    const getAsync = promisify(this.db.get.bind(this.db));
    return getAsync(sql, params);
  }

  public async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const allAsync = promisify(this.db.all.bind(this.db));
    return allAsync(sql, params);
  }

  public async exec(sql: string): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    const execAsync = promisify(this.db.exec.bind(this.db));
    return execAsync(sql);
  }

  // Transaction support
  public async beginTransaction(): Promise<void> {
    await this.run('BEGIN TRANSACTION');
  }

  public async commit(): Promise<void> {
    await this.run('COMMIT');
  }

  public async rollback(): Promise<void> {
    await this.run('ROLLBACK');
  }

  // Execute within transaction
  public async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.beginTransaction();
    try {
      const result = await callback();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

// Export singleton instance
export const database = Database.getInstance();