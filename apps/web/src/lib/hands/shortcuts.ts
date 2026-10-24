import type { ButtonKind } from 'poker-core';

/** What a keyboard event needs to say for us to decide (a real `KeyboardEvent` fits). */
export type KeyInput = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: object | null;
};
export type TargetLike = { tagName?: string; type?: string; isContentEditable?: boolean };

const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'range',
  'color',
  'file',
]);

/** The player is typing into a field: no shortcut may fire (Một câu suy nghĩ, tên, stack...). */
export function isTypingTarget(el: TargetLike | null): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((el.type ?? 'text').toLowerCase());
  return false;
}

export type GlobalShortcut =
  | { kind: 'button'; button: ButtonKind }
  | { kind: 'undo' }
  | { kind: 'street'; delta: -1 | 1 }
  | { kind: 'help' };

/** The key of each action button, shown on the button on desktop ("F Fold"). */
export const BUTTON_KEY: Record<ButtonKind, string> = {
  fold: 'F',
  call: 'C',
  check: 'X',
  bet: 'B',
  raise: 'R',
  open: 'O',
  'all-in': 'A',
};

const BUTTON_KEYS: Record<string, ButtonKind> = {
  f: 'fold',
  c: 'call',
  x: 'check',
  b: 'bet',
  r: 'raise',
  o: 'open',
  a: 'all-in',
};

/**
 * Shortcuts of the whole screen: F C X B R O A press that button when the state offers it
 * (`buttons` is `state.buttons`, so the keyboard never does what the screen would refuse),
 * Z undoes, ← → change street, ? lists them. Nothing fires while typing in a field or with
 * Ctrl/Cmd/Alt held (those belong to the browser).
 */
export function globalShortcut(
  ev: KeyInput,
  buttons: readonly ButtonKind[],
): GlobalShortcut | null {
  if (ev.ctrlKey || ev.metaKey || ev.altKey || isTypingTarget(ev.target as TargetLike | null))
    return null;
  const k = ev.key;
  if (k === '?') return { kind: 'help' };
  if (k === 'ArrowLeft') return { kind: 'street', delta: -1 };
  if (k === 'ArrowRight') return { kind: 'street', delta: 1 };
  const lower = k.toLowerCase();
  if (lower === 'z') return { kind: 'undo' };
  const button = BUTTON_KEYS[lower];
  return button && buttons.includes(button) ? { kind: 'button', button } : null;
}

const RANK_KEYS = 'akqjt98765432';
const SUIT_KEYS = 'hdcs';

/**
 * Typing a card into the selected slot: a rank key, then a suit key (`A` `h` → `Ah`). `10` is `T`.
 * Returns the half-typed rank to keep, and the finished card when there is one.
 */
export function cardEntry(pending: string, key: string): { pending: string; card: string | null } {
  if (key === 'Backspace' || key === 'Escape') return { pending: '', card: null };
  if (key.length !== 1) return { pending, card: null };
  const k = key.toLowerCase();
  if (pending === '1') {
    return k === '0' ? { pending: 'T', card: null } : { pending: '', card: null };
  }
  if (k === '1') return { pending: '1', card: null };
  if (RANK_KEYS.includes(k)) return { pending: k.toUpperCase(), card: null };
  if (pending && SUIT_KEYS.includes(k)) return { pending: '', card: `${pending}${k}` };
  return { pending, card: null };
}

/** Rows of the list opened with "?" (texts come from the message file by `id`). */
export const SHORTCUT_LIST: readonly { id: string; keys: string[] }[] = [
  { id: 'actions', keys: ['F', 'C', 'X', 'B', 'R', 'O', 'A'] },
  { id: 'amount', keys: ['0–9', 'K', 'Enter'] },
  { id: 'cards', keys: ['A K Q J T 9…2', 'H D C S'] },
  { id: 'undo', keys: ['Z'] },
  { id: 'street', keys: ['← →'] },
  { id: 'help', keys: ['?'] },
];
