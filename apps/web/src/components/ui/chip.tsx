import type { ButtonHTMLAttributes } from 'react';

/** Selectable pill (position, action, outcome...). `on` = selected. */
export function chipClass(on: boolean, extra = '') {
  return `flex h-11 items-center justify-center rounded-md border px-3 text-sm disabled:opacity-40 ${
    on ? 'border-accent bg-accent text-accent-foreground' : 'border-line bg-surface'
  } ${extra}`.trim();
}

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & { on: boolean };

export function Chip({ on, className, type = 'button', ...rest }: Props) {
  return <button type={type} aria-pressed={on} className={chipClass(on, className)} {...rest} />;
}
