export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type AppConfig = {
  nodeEnv: string;
  port: number;
  publicBaseUrl: string;
  kornixApiBaseUrl: string;
  kornixApiPrefix: string;
  kornixServiceToken: string;
  maxBotToken: string;
  maxWebhookSecret: string;
  logLevel: LogLevel;
};
