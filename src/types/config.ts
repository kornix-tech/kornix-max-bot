export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type AppConfig = {
  nodeEnv: string;
  port: number;
  kornixApiBaseUrl: string;
  kornixServiceToken: string;
  kornixInternalServiceIdentity: string;
  maxBotToken: string;
  maxWebhookSecret: string;
  maxApiBaseUrl: string;
  maxRequestTimeoutMs: number;
  defaultSeasonYear: number;
  logLevel: LogLevel;
  miniAppEnabled: boolean;
  miniAppPublicUrl: string;
  miniAppInitDataMaxAgeSeconds: number;
  miniAppSessionSecret: string;
  miniAppSessionTtlSeconds: number;
  miniAppAllowedOrigins: string[];
  miniAppPolivLinkUrl: string;
  miniAppDevMode: boolean;
  miniAppDevMaxUserId: string;
};
