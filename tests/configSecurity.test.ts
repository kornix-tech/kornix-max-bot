import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config/config.js';

describe('production security configuration', () => {
  it('fails closed when webhook or service credentials are absent', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /KORNIX_SERVICE_TOKEN/);
    assert.throws(
      () => loadConfig({ NODE_ENV: 'production', KORNIX_SERVICE_TOKEN: 'x'.repeat(32) }),
      /MAX_BOT_TOKEN/
    );
    assert.throws(
      () =>
        loadConfig({
          NODE_ENV: 'production',
          KORNIX_SERVICE_TOKEN: 'x'.repeat(32),
          MAX_BOT_TOKEN: 'y'.repeat(32)
        }),
      /MAX_WEBHOOK_SECRET/
    );
  });
});
