import type { MaxWebhookEvent, MaxWebhookHandler, MaxWebhookVerification } from '../types/max.js';

export function createMaxWebhookHandler(): MaxWebhookHandler {
  return {
    verify(): MaxWebhookVerification {
      return { isValid: true };
    },
    parse(rawBody: string): MaxWebhookEvent | null {
      if (!rawBody.trim()) {
        return null;
      }
      try {
        const parsed = JSON.parse(rawBody) as MaxWebhookEvent;
        return parsed;
      } catch {
        return null;
      }
    }
  };
}
