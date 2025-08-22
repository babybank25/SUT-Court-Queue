import fs from 'fs';
import path from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
}

class Logger {
  private logLevel: LogLevel;
  private logFile?: string;
  private isProduction: boolean;

  constructor() {
    this.logLevel = this.getLogLevel();
    this.logFile = process.env.LOG_FILE;
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Ensure log directory exists
    if (this.logFile) {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    switch (level) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = { timestamp, level, message };
    
    if (meta) {
      logEntry.meta = meta;
    }
    
    return JSON.stringify(logEntry);
  }

  private writeLog(level: string, message: string, meta?: any): void {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Console output (always in development, structured in production)
    if (!this.isProduction) {
      console.log(`[${level.toUpperCase()}] ${message}`, meta || '');
    } else {
      console.log(formattedMessage);
    }
    
    // File output
    if (this.logFile) {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    }
  }

  error(message: string, meta?: any): void {
    if (this.logLevel >= LogLevel.ERROR) {
      this.writeLog('error', message, meta);
    }
  }

  warn(message: string, meta?: any): void {
    if (this.logLevel >= LogLevel.WARN) {
      this.writeLog('warn', message, meta);
    }
  }

  info(message: string, meta?: any): void {
    if (this.logLevel >= LogLevel.INFO) {
      this.writeLog('info', message, meta);
    }
  }

  debug(message: string, meta?: any): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      this.writeLog('debug', message, meta);
    }
  }
}

export const logger = new Logger();