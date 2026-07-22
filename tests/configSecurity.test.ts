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

  it('requires a Mini App session secret only when the production feature is enabled', () => {
    const production = {
      NODE_ENV: 'production',
      KORNIX_SERVICE_TOKEN: 'k'.repeat(32),
      MAX_BOT_TOKEN: 'm'.repeat(32),
      MAX_WEBHOOK_SECRET: 'w'.repeat(32),
      MAX_MINIAPP_ENABLED: 'true'
    };
    assert.throws(() => loadConfig(production), /MAX_MINIAPP_SESSION_SECRET/);
    assert.equal(loadConfig({ ...production, MAX_MINIAPP_SESSION_SECRET: 's'.repeat(32) }).miniAppEnabled, true);
  });

  it('never enables development auth outside development', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'test', MAX_MINIAPP_DEV_MODE: 'true' }), /only be enabled/);
  });
});
