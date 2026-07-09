import type { AppConfig, LogLevel } from '../types/config.js';

const DEFAULT_PORT = 3000;
const DEFAULT_MAX_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_SEASON_YEAR = 2026;
const DEFAULT_KORNIX_INTERNAL_SERVICE_IDENTITY = 'operational-scheduler';
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

function readPositiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = readString(env, name, String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got: ${raw}`);
  }
  return value;
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
    kornixInternalServiceIdentity: readString(
      env,
      'KORNIX_INTERNAL_SERVICE_IDENTITY',
      DEFAULT_KORNIX_INTERNAL_SERVICE_IDENTITY
    ),
    maxBotToken: readString(env, 'MAX_BOT_TOKEN'),
    maxWebhookSecret: readString(env, 'MAX_WEBHOOK_SECRET'),
    maxApiBaseUrl: readString(env, 'MAX_API_BASE_URL', 'https://platform-api2.max.ru'),
    maxRequestTimeoutMs: readPositiveInteger(env, 'MAX_REQUEST_TIMEOUT_MS', DEFAULT_MAX_REQUEST_TIMEOUT_MS),
    defaultSeasonYear: readPositiveInteger(env, 'DEFAULT_SEASON_YEAR', DEFAULT_SEASON_YEAR),
    logLevel: readLogLevel(env)
  };
}
