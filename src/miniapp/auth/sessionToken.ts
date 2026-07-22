import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type MiniAppSession = {
  sessionId: string;
  maxUserId: string;
  issuedAt: number;
  expiresAt: number;
};

type SessionPayload = { v: 1; sid: string; sub: string; iat: number; exp: number };

export function createSessionToken(
  maxUserId: string,
  secret: string,
  ttlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): { token: string; session: MiniAppSession } {
  const payload: SessionPayload = {
    v: 1,
    sid: randomUUID(),
    sub: maxUserId,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encoded, secret);
  return { token: `${encoded}.${signature}`, session: toSession(payload) };
}

export function verifySessionToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): MiniAppSession | null {
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra || !secret) {
    return null;
  }
  const expected = Buffer.from(sign(encoded, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!isPayload(payload) || payload.exp <= nowSeconds || payload.iat > nowSeconds + 30) {
    return null;
  }
  return toSession(payload);
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function isPayload(value: unknown): value is SessionPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const item = value as Partial<SessionPayload>;
  return item.v === 1 && typeof item.sid === 'string' && typeof item.sub === 'string' &&
    Number.isInteger(item.iat) && Number.isInteger(item.exp);
}

function toSession(payload: SessionPayload): MiniAppSession {
  return {
    sessionId: payload.sid,
    maxUserId: payload.sub,
    issuedAt: payload.iat,
    expiresAt: payload.exp
  };
}
