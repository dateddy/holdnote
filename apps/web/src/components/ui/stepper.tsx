import { IconButton } from './icon-button';

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Shown between the buttons, e.g. "9 người". */
  text: string;
  minusLabel: string;
  plusLabel: string;
  className?: string;
};

/** `[−] 9 người [+]`: whole-number counter with two 44px buttons. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  text,
  minusLabel,
  plusLabel,
  className,
}: Props) {
  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`.trim()}>
      <IconButton
        glyph="−"
        label={minusLabel}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      />
      <span className="min-w-14 text-center text-sm tabular-nums" aria-live="polite">
        {text}
      </span>
      <IconButton
        glyph="+"
        label={plusLabel}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      />
    </div>
  );
}
