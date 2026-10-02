import type { ShorthandResult } from 'poker-core';
import type { HandDraft } from './build';

/** Append a key-row token to the shorthand line. */
export function insertToken(line: string, token: string): string {
  const base = line.trimEnd();
  if (token === '/') return base ? `${base} / ` : '/ ';
  return base ? `${base} ${token} ` : `${token} `;
}

/** The ⌫ key: drop the last token (a lone `/` counts as one). */
export function backspaceToken(line: string): string {
  const base = line.trimEnd();
  const cut = base.lastIndexOf(' ');
  return cut < 0 ? '' : `${base.slice(0, cut)} `;
}

/** Draft with the parsed actions and any board written in the line. Never overwrites picked cards. */
export function applyShorthand(draft: HandDraft, parsed: ShorthandResult): HandDraft {
  const slots = [...draft.slots];
  const { flop, turn, river } = parsed.boardFromLine;
  const fill = (index: number, card: string | undefined) => {
    if (card && !slots[index]) slots[index] = card;
  };
  flop?.forEach((card, i) => fill(2 + i, card));
  fill(5, turn);
  fill(6, river);
  return { ...draft, slots, actions: parsed.actions };
}
