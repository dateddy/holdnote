import { TONE_CLASS, type SeatTone } from './seat';

type Props = {
  tone: SeatTone;
  /** Who: "Mình", "Đối thủ" or a seat. */
  who: string;
  /** What: "Raise", "Call"... */
  what: string;
  /** Size such as "10", already formatted (bb). */
  amount?: string;
  /** False in a table: the colour already says who, the name stays for screen readers. */
  showWho?: boolean;
};

/** One action in a table row: small, not tappable. Hero green, opponent orange, the number is bb. */
export function ActionTag({ tone, who, what, amount, showWho = true }: Props) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded border px-1.5 text-xs whitespace-nowrap tabular-nums ${TONE_CLASS[tone]}`}
    >
      <span className={showWho ? 'font-medium' : 'sr-only'}>{who}</span>
      <span>{what}</span>
      {amount && <span className="text-muted">{amount}</span>}
    </span>
  );
}
