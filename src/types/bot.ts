export type BotCommandName =
  | 'unknown'
  | 'help'
  | 'status'
  | 'fields'
  | 'map'
  | 'profile'
  | 'recommendations'
  | 'irrigation';

export type ParsedCommand = {
  name: BotCommandName;
  rawText: string;
  args: string[];
};
