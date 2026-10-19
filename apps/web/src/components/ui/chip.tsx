import type { ButtonHTMLAttributes } from 'react';

/** Selectable pill (position, action, outcome...). `on` = selected. */
export function chipClass(on: boolean, extra = '', tone: 'accent' | 'villain' = 'accent') {
  const filled =
    tone === 'villain'
      ? 'border-villain bg-villain text-villain-foreground'
      : 'border-accent bg-accent text-accent-foreground';
  return `flex h-11 items-center justify-center rounded-md border px-3 text-sm disabled:opacity-40 ${
    on ? filled : 'border-line bg-surface'
  } ${extra}`.trim();
}

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  on: boolean;
  /** `villain`: orange, for the opponent's bar and seats. */
  tone?: 'accent' | 'villain';
};

export function Chip({ on, tone, className, type = 'button', ...rest }: Props) {
  return (
    <button type={type} aria-pressed={on} className={chipClass(on, className, tone)} {...rest} />
  );
}
