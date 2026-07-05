import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCommand } from '../src/bot/commandParser.js';

describe('parseCommand', () => {
  it('parses known commands case-insensitively and preserves args', () => {
    const command = parseCommand('/FiElDs north 10');

    assert.equal(command.type, 'fields');
    assert.equal(command.rawText, '/FiElDs north 10');
    assert.deepEqual(command.args, ['north', '10']);
  });

  it('returns unknown for unsupported commands', () => {
    const command = parseCommand('/approve now');

    assert.equal(command.type, 'unknown');
    assert.deepEqual(command.args, ['now']);
  });

  it('returns unknown for empty text', () => {
    const command = parseCommand('   ');

    assert.equal(command.type, 'unknown');
    assert.equal(command.rawText, '   ');
    assert.deepEqual(command.args, []);
  });
});
