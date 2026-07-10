import { timingSafeEqual } from 'node:crypto';

export const MAX_WEBHOOK_SECRET_HEADER = 'x-max-bot-api-secret';

export function verifyMaxWebhookSecret(
  headers: Record<string, string | string[] | undefined>,
  expectedSecret: string
): boolean {
  const secret = expectedSecret.trim();
  if (!secret) {
    return false;
  }

  const received = headerValue(headers, MAX_WEBHOOK_SECRET_HEADER);
  if (!received) {
    return false;
  }

  const expectedBuffer = Buffer.from(secret);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function headerValue(headers: Record<string, string | string[] | undefined>, target: string): string | null {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== target) {
      continue;
    }
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return value ?? null;
  }
  return null;
}
