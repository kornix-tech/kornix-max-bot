import type { BotContext } from './botContext.js';
import {
  beginFieldInputHandler,
  cancelHandler,
  confirmHandler,
  listFieldsForSelection,
  selectFieldHandler,
  workflowTextInputHandler
} from './fieldInputWorkflow.js';
import { commandButtonKeyboard } from './keyboards.js';
import {
  formatContext,
  formatHelp,
  formatMethods,
  formatReadiness,
  formatStatus,
  formatUnknownCommand
} from './messageFormatter.js';
import type { BotCommandName, BotResponse, ParsedCommand } from '../types/bot.js';

type CommandHandler = (context: BotContext, command: ParsedCommand) => Promise<BotResponse>;

const unknownHandler: CommandHandler = async (_context, command) => ({
  text: formatUnknownCommand(command.rawText)
});

const HANDLERS = new Map<BotCommandName, CommandHandler>([
  [
    'start',
    async () => ({
      text: ['КОРНИКС МАКС БОТ', 'Ввод поливов и осадков по полям.'].join('\n'),
      attachments: commandButtonKeyboard([{ text: 'Выбрать поле', command: '/fields' }], 1)
    })
  ],
  [
    'help',
    async () => ({
      text: formatHelp(),
      attachments: commandButtonKeyboard([{ text: 'Выбрать поле', command: '/fields' }], 1)
    })
  ],
  ['status', async (context) => ({ text: formatStatus(await context.kornixClient.getReadinessCurrent(context.seasonYear)) })],
  ['context', async (context) => ({ text: formatContext(await context.kornixClient.getCurrentContext(context.seasonYear)) })],
  ['fields', listFieldsForSelection],
  ['field', selectFieldHandler],
  ['water', (context, command) => beginFieldInputHandler(context, command, 'water')],
  ['rain', (context, command) => beginFieldInputHandler(context, command, 'rain')],
  ['confirm', confirmHandler],
  ['cancel', cancelHandler],
  ['methods', async (context) => ({ text: formatMethods(await context.kornixClient.getMethods()) })],
  [
    'readiness',
    async (context) => ({ text: formatReadiness(await context.kornixClient.getReadinessCurrent(context.seasonYear)) })
  ],
  ['unknown', unknownHandler]
]);

export async function dispatchCommand(command: ParsedCommand, context: BotContext): Promise<BotResponse> {
  if (command.type === 'unknown') {
    const workflowResponse = await workflowTextInputHandler(context, command);
    if (workflowResponse) {
      return workflowResponse;
    }
  }
  const handler = HANDLERS.get(command.type) ?? unknownHandler;
  return handler(context, command);
}
