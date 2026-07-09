import type { ParsedCommand } from '../types/bot.js';

const COMMAND_ALIASES = new Map<string, ParsedCommand['type']>([
  ['/start', 'start'],
  ['/help', 'help'],
  ['/status', 'status'],
  ['/context', 'context'],
  ['/fields', 'fields'],
  ['/field', 'field'],
  ['/select', 'field'],
  ['/water', 'water'],
  ['/rain', 'rain'],
  ['/confirm', 'confirm'],
  ['/cancel', 'cancel'],
  ['/methods', 'methods'],
  ['/readiness', 'readiness']
]);

export function parseCommand(rawText: string): ParsedCommand {
  const trimmed = rawText.trim();
  const [command = '', ...args] = trimmed.split(/\s+/);
  const type = COMMAND_ALIASES.get(command.toLowerCase()) ?? 'unknown';
  return {
    type,
    rawText,
    args
  };
}
