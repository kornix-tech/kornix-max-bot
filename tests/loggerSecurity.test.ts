import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createLogger } from '../src/utils/logger.js';

describe('logger secret redaction', () => {
  it('redacts credentials and launch data recursively', () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (line?: unknown) => lines.push(String(line));
    try {
      createLogger('info').info('safe_event', {
        Authorization: 'Bearer secret-value',
        nested: { initData: 'signed-launch-data', sessionToken: 'session-value' },
        safe: 'visible'
      });
    } finally {
      console.log = original;
    }
    assert.equal(lines.length, 1);
    assert.doesNotMatch(lines[0]!, /secret-value|signed-launch-data|session-value/);
    assert.match(lines[0]!, /\[REDACTED\]/);
    assert.match(lines[0]!, /visible/);
  });
});
