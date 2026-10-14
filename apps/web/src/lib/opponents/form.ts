import { isOneOf } from '@/lib/sessions/form';

/** `opponents.player_type` check values. */
export const PLAYER_TYPES = ['nit', 'tag', 'lag', 'station', 'maniac', 'unknown'] as const;
export type PlayerType = (typeof PLAYER_TYPES)[number];

const MAX = { name: 60, venue: 100, notes: 1000 } as const;

export type OpponentValues = {
  name: string;
  playerType: string;
  venue: string;
  notes: string;
};

export const OPPONENT_FIELDS = ['name', 'playerType', 'venue', 'notes'] as const;

export type OpponentErrors = Partial<
  Record<keyof OpponentValues, 'required' | 'invalid' | 'tooLong'>
>;

export type OpponentRow = {
  name: string;
  player_type: PlayerType | null;
  venue: string | null;
  notes: string | null;
};

export const emptyOpponentForm = (venue = ''): OpponentValues => ({
  name: '',
  playerType: '',
  venue,
  notes: '',
});

export function parseOpponentForm(
  v: OpponentValues,
): { ok: true; row: OpponentRow } | { ok: false; errors: OpponentErrors } {
  const errors: OpponentErrors = {};
  const name = v.name.trim();
  const venue = v.venue.trim();
  const notes = v.notes.trim();

  if (!name) errors.name = 'required';
  else if (name.length > MAX.name) errors.name = 'tooLong';
  if (v.playerType && !isOneOf(PLAYER_TYPES, v.playerType)) errors.playerType = 'invalid';
  if (venue.length > MAX.venue) errors.venue = 'tooLong';
  if (notes.length > MAX.notes) errors.notes = 'tooLong';
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    row: {
      name,
      player_type: isOneOf(PLAYER_TYPES, v.playerType) ? v.playerType : null,
      venue: venue || null,
      notes: notes || null,
    },
  };
}

export function opponentFormFrom(row: {
  name: string;
  player_type: string | null;
  venue: string | null;
  notes: string | null;
}): OpponentValues {
  return {
    name: row.name,
    playerType: row.player_type ?? '',
    venue: row.venue ?? '',
    notes: row.notes ?? '',
  };
}
