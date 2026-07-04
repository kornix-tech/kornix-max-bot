import type { HttpHandler } from '../types/http.js';
import type { Logger } from '../utils/logger.js';
import { readRequestBody } from '../middlewares/readRequestBody.js';
import { createMaxWebhookHandler } from '../max/maxWebhook.js';
import { sendJson } from '../utils/http.js';

export function createMaxWebhookHttpHandler(logger: Logger): HttpHandler {
  const webhook = createMaxWebhookHandler();

  return async (request, response) => {
    const rawBody = await readRequestBody(request);
    const verification = webhook.verify(rawBody, request.headers);
    if (!verification.isValid) {
      logger.warn('max_webhook_rejected', { reason: verification.reason });
      sendJson(response, 401, { ok: false });
      return;
    }
    webhook.parse(rawBody);
    sendJson(response, 200, { ok: true });
  };
}
