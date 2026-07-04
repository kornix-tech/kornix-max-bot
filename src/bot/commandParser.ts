import type { ParsedCommand } from '../types/bot.js';

export function parseCommand(rawText: string): ParsedCommand {
  const trimmed = rawText.trim();
  return {
    name: 'unknown',
    rawText,
    args: trimmed ? trimmed.split(/\s+/) : []
  };
}
