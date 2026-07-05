import type { BotContext } from './botContext.js';
import { contextHandler } from './handlers/contextHandler.js';
import { fieldsHandler } from './handlers/fieldsHandler.js';
import { helpHandler } from './handlers/helpHandler.js';
import { methodsHandler } from './handlers/methodsHandler.js';
import { readinessHandler } from './handlers/readinessHandler.js';
import { startHandler } from './handlers/startHandler.js';
import { statusHandler } from './handlers/statusHandler.js';
import { unknownHandler } from './handlers/unknownHandler.js';
import type { BotCommandName, BotResponse, ParsedCommand } from '../types/bot.js';

type CommandHandler = (context: BotContext, command: ParsedCommand) => Promise<BotResponse>;

const HANDLERS = new Map<BotCommandName, CommandHandler>([
  ['start', startHandler],
  ['help', helpHandler],
  ['status', statusHandler],
  ['context', contextHandler],
  ['fields', fieldsHandler],
  ['methods', methodsHandler],
  ['readiness', readinessHandler],
  ['unknown', unknownHandler]
]);

export async function dispatchCommand(command: ParsedCommand, context: BotContext): Promise<BotResponse> {
  const handler = HANDLERS.get(command.type) ?? unknownHandler;
  return handler(context, command);
}
