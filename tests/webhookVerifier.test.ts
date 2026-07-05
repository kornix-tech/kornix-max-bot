import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verifyMaxWebhookSecret } from '../src/max/webhookVerifier.js';

describe('verifyMaxWebhookSecret', () => {
  it('accepts a matching secret header', () => {
    assert.equal(verifyMaxWebhookSecret({ 'X-Max-Bot-Api-Secret': 'secret' }, 'secret'), true);
  });

  it('rejects invalid and missing secrets', () => {
    assert.equal(verifyMaxWebhookSecret({ 'x-max-bot-api-secret': 'wrong' }, 'secret'), false);
    assert.equal(verifyMaxWebhookSecret({}, 'secret'), false);
  });

  it('is disabled when configured secret is empty', () => {
    assert.equal(verifyMaxWebhookSecret({}, ''), true);
    assert.equal(verifyMaxWebhookSecret({}, '   '), true);
  });
});
