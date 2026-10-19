import type { SeatTone } from '@/components/ui/seat';

/** One chip of the action timeline, ready to draw. */
export type PillData = {
  /** Index in the full actions array (forced bets included). */
  index: number;
  tone: SeatTone;
  who: string;
  what: string;
  amount?: string;
  invalid: boolean;
};
