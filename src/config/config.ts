import type { AppConfig, LogLevel } from '../types/config.js';

const DEFAULT_PORT = 3000;
const DEFAULT_MAX_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_SEASON_YEAR = 2026;
const DEFAULT_KORNIX_INTERNAL_SERVICE_IDENTITY = 'max-bot';
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
  const nodeEnv = readString(env, 'NODE_ENV', 'development');
  const kornixServiceToken = readString(env, 'KORNIX_SERVICE_TOKEN');
  const maxBotToken = readString(env, 'MAX_BOT_TOKEN');
  const maxWebhookSecret = readString(env, 'MAX_WEBHOOK_SECRET');
  if (nodeEnv === 'production') {
    for (const [name, value] of [
      ['KORNIX_SERVICE_TOKEN', kornixServiceToken],
      ['MAX_BOT_TOKEN', maxBotToken],
      ['MAX_WEBHOOK_SECRET', maxWebhookSecret]
    ] as const) {
      if (value.length < 32) {
        throw new Error(`${name} must be configured with at least 32 characters in production.`);
      }
    }
  }
  return {
    nodeEnv,
    port: readPort(env),
    kornixApiBaseUrl: readString(env, 'KORNIX_API_BASE_URL', 'https://poliv360.ru'),
    kornixServiceToken,
    kornixInternalServiceIdentity: readString(
      env,
      'KORNIX_INTERNAL_SERVICE_IDENTITY',
      DEFAULT_KORNIX_INTERNAL_SERVICE_IDENTITY
    ),
    maxBotToken,
    maxWebhookSecret,
    maxApiBaseUrl: readString(env, 'MAX_API_BASE_URL', 'https://platform-api2.max.ru'),
    maxRequestTimeoutMs: readPositiveInteger(env, 'MAX_REQUEST_TIMEOUT_MS', DEFAULT_MAX_REQUEST_TIMEOUT_MS),
    defaultSeasonYear: readPositiveInteger(env, 'DEFAULT_SEASON_YEAR', DEFAULT_SEASON_YEAR),
    logLevel: readLogLevel(env)
  };
}
