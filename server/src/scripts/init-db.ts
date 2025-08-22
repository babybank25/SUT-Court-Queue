#!/usr/bin/env ts-node

/**
 * Database initialization script
 * This script initializes the database with schema and seed data
 */

import { initializeDatabase, closeDatabase } from "../database";

async function main() {
  try {
    console.log("Initializing database...");
    await initializeDatabase();
    console.log("Database initialization completed successfully!");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}
