import { randomUUID } from 'node:crypto';
import type { HttpHandler } from '../types/http.js';
import type { Logger } from '../utils/logger.js';
import { readRequestBody } from '../middlewares/readRequestBody.js';
import { processMaxWebhook } from '../max/maxWebhook.js';
import { verifyMaxWebhookSecret } from '../max/webhookVerifier.js';
import { sendJson } from '../utils/http.js';
import type { KornixClient } from '../kornix/kornixClient.js';
import type { MaxClient } from '../max/maxClient.js';

export type MaxWebhookHttpHandlerOptions = {
  logger: Logger;
  webhookSecret: string;
  defaultSeasonYear: number;
  kornixClient: KornixClient;
  maxClient: MaxClient;
};

export function createMaxWebhookHttpHandler(options: MaxWebhookHttpHandlerOptions): HttpHandler {
  return async (request, response) => {
    const rawBody = await readRequestBody(request);
    const requestId = request.headers['x-request-id']?.toString() ?? randomUUID();

    if (!verifyMaxWebhookSecret(request.headers, options.webhookSecret)) {
      options.logger.warn('max_webhook_rejected', { requestId, reason: 'secret_mismatch' });
      sendJson(response, 401, { ok: false });
      return;
    }

    await processMaxWebhook({
      rawBody,
      requestId,
      seasonYear: options.defaultSeasonYear,
      kornixClient: options.kornixClient,
      maxClient: options.maxClient,
      logger: options.logger
    });

    sendJson(response, 200, { ok: true });
  };
}
