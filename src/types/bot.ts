export type BotCommandName =
  | 'unknown'
  | 'start'
  | 'help'
  | 'status'
  | 'context'
  | 'fields'
  | 'field'
  | 'water'
  | 'rain'
  | 'fieldStatus'
  | 'addMore'
  | 'confirm'
  | 'cancel'
  | 'methods'
  | 'readiness';

export type ParsedCommand = {
  type: BotCommandName;
  rawText: string;
  args: string[];
};

export type BotResponse = {
  text: string;
  attachments?: unknown[] | null;
};
