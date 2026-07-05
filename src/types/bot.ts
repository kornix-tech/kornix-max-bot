export type BotCommandName =
  | 'unknown'
  | 'start'
  | 'help'
  | 'status'
  | 'context'
  | 'fields'
  | 'methods'
  | 'readiness';

export type ParsedCommand = {
  type: BotCommandName;
  rawText: string;
  args: string[];
};

export type BotResponse = {
  text: string;
};
