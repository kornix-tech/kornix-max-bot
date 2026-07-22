import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSessionToken, verifySessionToken } from '../src/miniapp/auth/sessionToken.js';

describe('Mini App session tokens', () => {
  it('creates and verifies a short-lived signed token', () => {
    const created = createSessionToken('max-42', 's'.repeat(32), 60, 1000);
    assert.equal(verifySessionToken(created.token, 's'.repeat(32), 1050)?.maxUserId, 'max-42');
  });

  it('rejects expired, altered and wrongly signed tokens', () => {
    const created = createSessionToken('max-42', 's'.repeat(32), 60, 1000);
    assert.equal(verifySessionToken(created.token, 's'.repeat(32), 1060), null);
    assert.equal(verifySessionToken(`${created.token}x`, 's'.repeat(32), 1050), null);
    assert.equal(verifySessionToken(created.token, 'x'.repeat(32), 1050), null);
  });
});
