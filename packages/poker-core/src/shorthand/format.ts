import { STREETS, type Action, type Card } from '../types';

/** Token for an action, picking the shorthand code that keeps the verb nuance. */
function actToken(a: Action): string | null {
  const amount = a.amount === undefined ? '' : String(a.amount);
  switch (a.act) {
    case 'check':
      return 'x';
    case 'fold':
      return 'f';
    case 'call':
      return a.verb === 'limp' ? 'lp' : 'c';
    case 'all-in':
      return `ai${amount}`;
    case 'bet':
      return `${a.verb === 'lead' ? 'l' : a.verb === 'donk' ? 'd' : 'b'}${amount}`;
    case 'raise': {
      const code =
        a.verb === 'open'
          ? 'o'
          : a.verb === '3bet'
            ? '3b'
            : a.verb === '4bet'
              ? '4b'
              : a.verb === '5bet'
                ? '5b'
                : a.verb === 'check-raise'
                  ? 'cr'
                  : 'r';
      return `${code}${amount}`;
    }
    // Forced bets and dead money have no shorthand: the setup and the betting imply them.
    default:
      return null;
  }
}

function actorToken(a: Action): string {
  if (a.actor === 'hero') return 'H';
  if (a.actor === 'villain') return 'V';
  // Checks and folds may go without an actor; anything else needs a label.
  return a.pos ?? a.who ?? (a.act === 'check' || a.act === 'fold' ? '' : 'V1');
}

/** Board cards that open each postflop street: flop (3), turn, river. */
function streetBoard(board: readonly Card[], index: number): string {
  if (index === 1) return board.slice(0, 3).join('');
  if (index === 2) return board.slice(3, 4).join('');
  if (index === 3) return board.slice(4, 5).join('');
  return '';
}

/**
 * Turn `actions` into a shorthand line (`H o600 V c / 8sQhJh V x H b800 ...`), the inverse of
 * `parseShorthand`. Call amounts are left out: they follow from the betting. Board cards, when
 * given, open their street.
 */
export function formatShorthand(actions: Action[], board: readonly Card[] = []): string {
  const segments = STREETS.map((street, i) => {
    const tokens = actions
      .filter((a) => a.street === street && actToken(a) !== null)
      .map((a) => [actorToken(a), actToken(a)].filter(Boolean).join(' '));
    return [streetBoard(board, i), ...tokens].filter(Boolean).join(' ');
  });
  while (segments.length > 0 && !segments[segments.length - 1]) segments.pop();
  return segments.join(' / ');
}
