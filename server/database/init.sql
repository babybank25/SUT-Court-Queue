-- PostgreSQL initialization script for SUT Court Queue
-- This script will be run when the PostgreSQL container starts

-- Create database if it doesn't exist (handled by Docker environment variables)
-- CREATE DATABASE IF NOT EXISTS sut_court_queue;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The actual table creation will be handled by the migration system
-- This file is mainly for PostgreSQL-specific setup

-- Set timezone
SET timezone = 'Asia/Bangkok';

-- Create a simple health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS TABLE(status text, timestamp timestamptz) AS $$
BEGIN
    RETURN QUERY SELECT 'OK'::text, now();
END;
$$ LANGUAGE plpgsql;