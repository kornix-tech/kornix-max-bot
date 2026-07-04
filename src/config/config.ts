import type { AppConfig, LogLevel } from '../types/config.js';

const DEFAULT_PORT = 3000;
const LOG_LEVELS = new Set<LogLevel>(['debug', 'info', 'warn', 'error']);

function readString(env: NodeJS.ProcessEnv, name: string, fallback = ''): string {
  return env[name]?.trim() || fallback;
}

function readPort(env: NodeJS.ProcessEnv): number {
  const raw = readString(env, 'PORT', String(DEFAULT_PORT));
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got: ${raw}`);
  }
  return port;
}

function readLogLevel(env: NodeJS.ProcessEnv): LogLevel {
  const raw = readString(env, 'LOG_LEVEL', 'info') as LogLevel;
  return LOG_LEVELS.has(raw) ? raw : 'info';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    nodeEnv: readString(env, 'NODE_ENV', 'development'),
    port: readPort(env),
    publicBaseUrl: readString(env, 'PUBLIC_BASE_URL', 'https://poliv360.ru'),
    kornixApiBaseUrl: readString(env, 'KORNIX_API_BASE_URL', 'https://poliv360.ru'),
    kornixApiPrefix: readString(env, 'KORNIX_API_PREFIX', '/api/v2/kornix'),
    kornixServiceToken: readString(env, 'KORNIX_SERVICE_TOKEN'),
    maxBotToken: readString(env, 'MAX_BOT_TOKEN'),
    maxWebhookSecret: readString(env, 'MAX_WEBHOOK_SECRET'),
    logLevel: readLogLevel(env)
  };
}
