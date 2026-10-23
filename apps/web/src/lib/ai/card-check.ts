/**
 * Cards the AI names in its text, checked against the hand (task 5.1f). The model sometimes gives
 * Hero cards it does not hold or puts cards on the board that are not there; poker-core knows the
 * real ones, so a wrong card can be caught and sent back once with the right ones.
 */

export type CardFacts = {
  hero: readonly string[];
  board: readonly string[];
  /** Cards an opponent showed: the AI may name them. */
  villain: readonly string[];
};

export type CardToken = { cards: string[]; index: number; text: string };

const SUIT: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
const CARD = '(?:10|[2-9TJQKA])[shdc♠♥♦♣]';
// A run of cards, glued (QhQc) or one space apart (A♦ Q♦), not inside a word or number.
const RUN = new RegExp(`(?<![\\p{L}\\p{N}])${CARD}(?:\\s?${CARD})*(?![\\p{L}\\p{N}])`, 'gu');
const ONE = new RegExp(CARD, 'gu');

const norm = (c: string) => {
  const rank = c.startsWith('10') ? 'T' : c[0]!;
  const suit = c.slice(c.startsWith('10') ? 2 : 1);
  return `${rank}${SUIT[suit] ?? suit}`;
};

/** Every run of cards in `text`, with the cards in `Qh` form. */
export function cardTokens(text: string): CardToken[] {
  const out: CardToken[] = [];
  for (const m of text.matchAll(RUN)) {
    const cards = [...m[0].matchAll(ONE)].map((c) => norm(c[0]));
    // English "As the river..." is a word, not the ace of spades.
    if (cards.length === 1 && m[0] === 'As' && /^\s+\p{Ll}/u.test(text.slice(m.index + 2))) {
      continue;
    }
    out.push({ cards, index: m.index, text: m[0] });
  }
  return out;
}

/** Cards right after a word about the opponent or a range may be any cards ("đối thủ có QhQc"). */
const OPPONENT = /đối thủ|villain|opponent|range|combo|(^|[\s(,])(họ|they|their)([\s,.)]|$)/iu;
/** How far before the cards that word may stand. */
const OPPONENT_REACH = 60;
const BOARD_WORD = /(board|flop|turn|river)\W{0,3}$/iu;

const known = (cards: readonly string[]) => cards.filter((c) => /^[2-9TJQKA][shdc]$/.test(c));
const fmt = (cards: readonly string[]) => cards.join('');

/**
 * What is wrong with the cards in `texts`, as one line to send back to the model; null when
 * nothing is. Cards right after a board word must be on the board; unless a word about the
 * opponent comes shortly before them, a two-card holding must be Hero's (or a shown hand) and any
 * card must be in the hand.
 */
export function cardMistake(texts: readonly string[], facts: CardFacts): string | null {
  const hero = known(facts.hero);
  const board = known(facts.board);
  const shown = known(facts.villain);
  const heroKnown = hero.length === 2;
  if (!heroKnown && board.length === 0) return null;
  const inHand = new Set([...hero, ...board, ...shown]);
  const sameSet = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((c) => b.includes(c));

  const wrong: string[] = [];
  for (const text of texts) {
    for (const sentence of text.split(/(?<=[.!?;\n])\s+/u)) {
      for (const t of cardTokens(sentence)) {
        const aboutOpponent = OPPONENT.test(
          sentence.slice(Math.max(0, t.index - OPPONENT_REACH), t.index),
        );
        if (BOARD_WORD.test(sentence.slice(0, t.index))) {
          if (board.length && t.cards.some((c) => !board.includes(c))) wrong.push(t.text);
          continue;
        }
        if (aboutOpponent || !heroKnown) continue;
        const holding =
          t.cards.length === 2 &&
          !sameSet(t.cards, hero) &&
          !(shown.length === 2 && sameSet(t.cards, shown));
        if (holding || t.cards.some((c) => !inHand.has(c))) wrong.push(t.text);
      }
    }
  }
  if (!wrong.length) return null;
  const parts = [
    `Card error: ${heroKnown ? `Hero's cards are ${fmt(hero)}` : "Hero's cards are unknown"}, not ${[...new Set(wrong)].join(', ')}.`,
    board.length ? `Board: ${board.join(' ')}.` : 'No board.',
    'Name only these cards for Hero and the board; rewrite the fields that mention other cards. Keep the same judgement otherwise.',
  ];
  return parts.join(' ');
}
