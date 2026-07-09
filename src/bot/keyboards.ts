import type { MaxInlineKeyboardAttachment, MaxInlineKeyboardButton } from '../max/maxTypes.js';

type CommandButton = {
  text: string;
  command: string;
};

export function commandButtonKeyboard(buttons: CommandButton[], columns = 3): MaxInlineKeyboardAttachment[] {
  return [
    {
      type: 'inline_keyboard',
      payload: {
        buttons: chunk(buttons, columns).map((row) =>
          row.map(
            (button): MaxInlineKeyboardButton => ({
              type: 'callback',
              text: button.text,
              payload: button.command
            })
          )
        )
      }
    }
  ];
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}
