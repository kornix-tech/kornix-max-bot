import { createServer } from 'node:http';
import { loadConfig } from './config/config.js';
import { createMaxWebhookHttpHandler, healthHandler } from './handlers/index.js';
import { KornixClient } from './kornix/kornixClient.js';
import { MaxClient } from './max/maxClient.js';
import { createLogger } from './utils/logger.js';
import { sendMethodNotAllowed, sendNotFound } from './utils/http.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const kornixClient = new KornixClient(
  {
    baseUrl: config.kornixApiBaseUrl,
    serviceToken: config.kornixServiceToken,
    internalServiceIdentity: config.kornixInternalServiceIdentity,
    timeoutMs: 30_000
  },
  logger
);
const maxClient = new MaxClient(
  {
    baseUrl: config.maxApiBaseUrl,
    botToken: config.maxBotToken,
    timeoutMs: config.maxRequestTimeoutMs
  },
  logger
);
const maxWebhookHandler = createMaxWebhookHttpHandler({
  logger,
  webhookSecret: config.maxWebhookSecret,
  defaultSeasonYear: config.defaultSeasonYear,
  kornixClient,
  maxClient
});

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (url.pathname === '/health') {
      if (request.method !== 'GET') {
        sendMethodNotAllowed(response);
        return;
      }
      await healthHandler(request, response);
      return;
    }

    if (url.pathname === '/max/webhook') {
      if (request.method !== 'POST') {
        sendMethodNotAllowed(response);
        return;
      }
      await maxWebhookHandler(request, response);
      return;
    }

    sendNotFound(response);
  } catch (error) {
    logger.error('request_failed', {
      message: error instanceof Error ? error.message : String(error)
    });
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error.' } }));
  }
});

server.listen(config.port, () => {
  logger.info('server_started', { port: config.port, nodeEnv: config.nodeEnv });
});
