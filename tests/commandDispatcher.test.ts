import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dispatchCommand } from '../src/bot/commandDispatcher.js';
import { parseCommand } from '../src/bot/commandParser.js';
import type { BotContext } from '../src/bot/botContext.js';

describe('dispatchCommand', () => {
  it('routes every old bot action to the Mini App guide without attachments', async () => {
    const context = {} as BotContext;
    for (const text of ['/start', '/help', '/status', '/fields', '/field 1.1', '/water', '/rain', '/confirm', '/cancel', '25']) {
      const response = await dispatchCommand(parseCommand(text), context);
      assert.match(response.text, /кнопку «Открыть»/);
      assert.match(response.text, /Все функции доступны только в Mini App/);
      assert.equal(response.attachments, undefined);
    }
  });
});
