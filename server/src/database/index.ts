// Database module exports
export { database, Database } from './connection';
export { migrationManager, MigrationManager } from './migrations';
export { CrudRepository, CrudOptions } from './crud';
export {
  TeamRepository,
  MatchRepository,
  CourtStatusRepository,
  QueueStateRepository,
  teamRepository,
  matchRepository,
  courtStatusRepository,
  queueStateRepository,
} from './models';

// Initialize database function
export async function initializeDatabase(): Promise<void> {
  try {
    // Import here to avoid circular dependency issues
    const { database } = await import('./connection');
    const { migrationManager } = await import('./migrations');
    
    // Connect to database
    await database.connect();
    
    // Run migrations
    await migrationManager.migrate();
    
    // Seed initial data if needed
    await migrationManager.seed();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// Cleanup database function
export async function closeDatabase(): Promise<void> {
  try {
    const { database } = await import('./connection');
    await database.close();
    console.log('Database closed successfully');
  } catch (error) {
    console.error('Failed to close database:', error);
    throw error;
  }
}