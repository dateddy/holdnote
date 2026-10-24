import { describe, expect, it } from 'vitest';
import type { ButtonKind } from 'poker-core';
import { cardEntry, globalShortcut, isTypingTarget, SHORTCUT_LIST } from './shortcuts';

const key = (k: string, over: Partial<Parameters<typeof globalShortcut>[0]> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: { tagName: 'BODY' },
  ...over,
});
const buttons: ButtonKind[] = ['fold', 'call', 'raise', 'all-in'];

describe('isTypingTarget', () => {
  it('text fields, textareas, selects and editable content are typing', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'search' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });
  it('buttons, the page and nothing are not', () => {
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BODY' })).toBe(false);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('globalShortcut', () => {
  it('F C X B R O A press the button when the state offers it', () => {
    expect(globalShortcut(key('f'), buttons)).toEqual({ kind: 'button', button: 'fold' });
    expect(globalShortcut(key('C'), buttons)).toEqual({ kind: 'button', button: 'call' });
    expect(globalShortcut(key('r'), buttons)).toEqual({ kind: 'button', button: 'raise' });
    expect(globalShortcut(key('a'), buttons)).toEqual({ kind: 'button', button: 'all-in' });
  });
  it('a button the state does not offer does nothing', () => {
    expect(globalShortcut(key('x'), buttons)).toBeNull(); // no check
    expect(globalShortcut(key('b'), buttons)).toBeNull(); // no bet
    expect(globalShortcut(key('o'), buttons)).toBeNull(); // no open
    expect(globalShortcut(key('f'), [])).toBeNull();
  });
  it('Z undoes, arrows change street, ? opens the list', () => {
    expect(globalShortcut(key('z'), buttons)).toEqual({ kind: 'undo' });
    expect(globalShortcut(key('ArrowLeft'), buttons)).toEqual({ kind: 'street', delta: -1 });
    expect(globalShortcut(key('ArrowRight'), buttons)).toEqual({ kind: 'street', delta: 1 });
    expect(globalShortcut(key('?'), buttons)).toEqual({ kind: 'help' });
  });
  it('typing in a text field never triggers anything', () => {
    for (const k of ['f', 'c', 'x', 'b', 'r', 'o', 'a', 'z', '?', 'ArrowLeft', '5', 'Enter']) {
      for (const target of [
        { tagName: 'INPUT', type: 'text' },
        { tagName: 'INPUT', type: 'search' },
        { tagName: 'TEXTAREA' },
        { tagName: 'DIV', isContentEditable: true },
      ]) {
        expect(globalShortcut(key(k, { target }), buttons)).toBeNull();
      }
    }
  });
  it('a key with Ctrl, Cmd or Alt belongs to the browser', () => {
    expect(globalShortcut(key('r', { ctrlKey: true }), buttons)).toBeNull();
    expect(globalShortcut(key('z', { metaKey: true }), buttons)).toBeNull();
    expect(globalShortcut(key('f', { altKey: true }), buttons)).toBeNull();
  });
  it('unknown keys do nothing', () => {
    expect(globalShortcut(key('q'), buttons)).toBeNull();
    expect(globalShortcut(key('Enter'), buttons)).toBeNull();
  });
});

describe('cardEntry', () => {
  it('rank then suit makes a card', () => {
    expect(cardEntry('', 'a')).toEqual({ pending: 'A', card: null });
    expect(cardEntry('A', 'h')).toEqual({ pending: '', card: 'Ah' });
    expect(cardEntry('', 'T')).toEqual({ pending: 'T', card: null });
    expect(cardEntry('T', 'D')).toEqual({ pending: '', card: 'Td' });
    expect(cardEntry('', '9')).toEqual({ pending: '9', card: null });
  });
  it('10 counts as T', () => {
    expect(cardEntry('', '1')).toEqual({ pending: '1', card: null });
    expect(cardEntry('1', '0')).toEqual({ pending: 'T', card: null });
  });
  it('a second rank replaces the first (typo); a suit alone waits for a rank', () => {
    expect(cardEntry('A', 'k')).toEqual({ pending: 'K', card: null });
    expect(cardEntry('', 'h')).toEqual({ pending: '', card: null });
  });
  it('Backspace or Escape forgets a half-typed card; other keys are ignored', () => {
    expect(cardEntry('K', 'Backspace')).toEqual({ pending: '', card: null });
    expect(cardEntry('K', 'Escape')).toEqual({ pending: '', card: null });
    expect(cardEntry('K', 'z')).toEqual({ pending: 'K', card: null });
  });
});

describe('the list shown with "?"', () => {
  it('names every key the screen reacts to', () => {
    const keys = SHORTCUT_LIST.flatMap((g) => g.keys);
    for (const k of ['F', 'C', 'X', 'B', 'R', 'O', 'A', 'Z', '← →', '?', 'Enter']) {
      expect(keys).toContain(k);
    }
  });
});
