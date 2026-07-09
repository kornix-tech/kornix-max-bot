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

  it('parses field input workflow commands', () => {
    assert.equal(parseCommand('/field 3').type, 'field');
    assert.equal(parseCommand('/water today 25').type, 'water');
    assert.equal(parseCommand('/rain 2026-07-10 12').type, 'rain');
    assert.equal(parseCommand('/confirm').type, 'confirm');
    assert.equal(parseCommand('/cancel').type, 'cancel');
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
