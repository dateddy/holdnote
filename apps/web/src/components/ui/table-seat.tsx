export type TableSeatTone = 'hero' | 'opponent' | 'other';

const FILLED: Record<TableSeatTone, string> = {
  hero: 'border-accent bg-accent text-accent-foreground',
  opponent: 'border-villain bg-villain text-villain-foreground',
  other: 'border-line bg-surface',
};

type Props = {
  /** Seat name: "BTN". */
  position: string;
  tone: TableSeatTone;
  /** Chips behind, already formatted (bb); left out when the stack is not known. */
  stack?: string;
  /** Still in the hand. Out of the hand (folded, never played): faded and outlined. */
  inHand: boolean;
  /** Short word under the stack: "All-in", "Fold". */
  note?: string;
  /** Spoken name, e.g. "BTN, Đối thủ, 180 bb". The colour alone says nothing to a screen reader. */
  label: string;
};

/** A seat of the replay table: position, stack, and who sits there by colour. Not tappable. */
export function TableSeat({ position, tone, stack, inHand, note, label }: Props) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex min-h-11 min-w-14 flex-col items-center justify-center rounded-md border px-1.5 py-0.5 text-center text-xs leading-tight tabular-nums ${
        inHand ? FILLED[tone] : 'border-line bg-surface text-muted opacity-50'
      }`}
    >
      <span className="font-medium">{position}</span>
      {stack !== undefined && <span>{stack}</span>}
      {note && <span className="font-medium">{note}</span>}
    </div>
  );
}
