import type { ButtonHTMLAttributes } from 'react';

export type SeatTone = 'hero' | 'villain' | 'other';

export const TONE_CLASS: Record<SeatTone, string> = {
  hero: 'border-accent bg-accent/15',
  villain: 'border-villain bg-villain/15',
  other: 'border-line bg-surface',
};

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  position: string;
  tone: SeatTone;
  /** Word under the position: "Mình", "Đối thủ". Colour never carries the meaning alone. */
  caption?: string;
  toAct?: boolean;
  folded?: boolean;
  addable?: boolean;
};

/** A seat on the mini table. */
export function Seat({
  position,
  tone,
  caption,
  toAct = false,
  folded = false,
  addable = false,
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      aria-current={toAct || undefined}
      className={`flex h-11 min-w-11 flex-col items-center justify-center rounded-md border px-1 text-xs leading-tight disabled:cursor-default ${
        TONE_CLASS[tone]
      } ${toAct ? 'ring-2 ring-accent' : ''} ${addable ? 'border-dashed' : ''} ${
        folded ? 'opacity-40' : ''
      } ${className ?? ''}`.trim()}
      {...rest}
    >
      <span className="font-medium">{position}</span>
      {caption && <span className="text-muted">{caption}</span>}
    </button>
  );
}
