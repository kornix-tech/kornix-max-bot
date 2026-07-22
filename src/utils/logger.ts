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
      ...(meta ? { meta: redact(meta) } : {})
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

const SECRET_KEY = /authorization|cookie|token|secret|initdata|hash/i;

function redact(value: unknown, key = ''): unknown {
  if (SECRET_KEY.test(key)) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  }
  return value;
}
