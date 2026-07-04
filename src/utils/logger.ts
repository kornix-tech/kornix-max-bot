import type { LogLevel } from '../types/config.js';

const PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export type Logger = {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
};

export function createLogger(level: LogLevel): Logger {
  function write(entryLevel: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (PRIORITY[entryLevel] < PRIORITY[level]) {
      return;
    }
    const payload = {
      level: entryLevel,
      time: new Date().toISOString(),
      message,
      ...(meta ? { meta } : {})
    };
    const line = JSON.stringify(payload);
    if (entryLevel === 'error') {
      console.error(line);
      return;
    }
    if (entryLevel === 'warn') {
      console.warn(line);
      return;
    }
    console.log(line);
  }

  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta)
  };
}
