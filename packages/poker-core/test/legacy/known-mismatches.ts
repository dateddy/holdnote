/**
 * Real hands whose saved result the core does not reproduce, and why.
 * `expected` pins what the core computes today so any change in the math shows up here.
 * Ids and reasons only: no opponent names.
 */
export type MismatchReason =
  /** Online cash win: the old app saved the result after rake (computed is 4–7% of the pot higher). Rake is not in the spec. */
  | 'rake'
  /** NLHA table (0.01 ante per player) but the hand never saved how many players were dealt, so the pot is unknown. */
  | 'players_dealt_unknown'
  /** Saved win is larger than the written line can produce: actions or callers are missing from the line (screenshot import). */
  | 'line_missing_money';

export interface KnownMismatch {
  reason: MismatchReason;
  recorded: number;
  expected: number | null;
}

export const KNOWN_MISMATCHES: Record<string, KnownMismatch> = {
  // Rake on NLHA wins (players dealt known).
  n1001h02: { reason: 'rake', recorded: 0.77, expected: 0.86 },
  n1001h05: { reason: 'rake', recorded: 0.38, expected: 0.43 },
  n1001h07: { reason: 'rake', recorded: 0.27, expected: 0.29 },
  n1001h08: { reason: 'rake', recorded: 0.92, expected: 1.03 },
  w18h02: { reason: 'rake', recorded: 0.37, expected: 0.4 },
  w18h05: { reason: 'rake', recorded: 0.95, expected: 1.07 },
  w39h02: { reason: 'rake', recorded: 0.37, expected: 0.42 },
  w39h04: { reason: 'rake', recorded: 0.65, expected: 0.71 },
  w44h01: { reason: 'rake', recorded: 3.75, expected: 4.07 },
  w44h03: { reason: 'rake', recorded: 0.96, expected: 1.07 },
  w44h04: { reason: 'rake', recorded: 0.47, expected: 0.52 },

  // NLHA wins without players dealt: result is "missing data".
  nl2s3h02: { reason: 'players_dealt_unknown', recorded: 0.27, expected: null },
  nl2s3h03: { reason: 'players_dealt_unknown', recorded: 0.22, expected: null },
  nl2s3h04: { reason: 'players_dealt_unknown', recorded: 0.63, expected: null },
  nl2s3h05: { reason: 'players_dealt_unknown', recorded: 0.48, expected: null },
  nl2s3h06: { reason: 'players_dealt_unknown', recorded: 0.17, expected: null },
  nl2s3h07: { reason: 'players_dealt_unknown', recorded: 0.97, expected: null },
  nl2s3h08: { reason: 'players_dealt_unknown', recorded: 0.54, expected: null },
  nl2s3h10: { reason: 'players_dealt_unknown', recorded: 0.21, expected: null },
  nl2s3h12: { reason: 'players_dealt_unknown', recorded: 1.99, expected: null },
  nl2s3h13: { reason: 'players_dealt_unknown', recorded: 0.29, expected: null },
  tilt0929h03: { reason: 'players_dealt_unknown', recorded: 1.33, expected: null },

  // Saved win bigger than the line explains.
  nl2h02: { reason: 'line_missing_money', recorded: 0.26, expected: 0.17 },
  nl2h06: { reason: 'line_missing_money', recorded: 1.76, expected: 1.68 },
  nl2h08: { reason: 'line_missing_money', recorded: 0.22, expected: 0.13 },
  nl2h10: { reason: 'line_missing_money', recorded: 1.08, expected: 1.02 },
};
