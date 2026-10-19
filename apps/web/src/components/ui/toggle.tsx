import type { ButtonHTMLAttributes } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'aria-checked'> & {
  checked: boolean;
};

/** On/off switch. Put the label next to it, or pass `aria-label` when there is no visible text. */
export function Toggle({ checked, className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      className={`flex h-11 w-14 shrink-0 items-center rounded-md border px-1 ${
        checked ? 'justify-end border-accent bg-accent/15' : 'justify-start border-line bg-surface'
      } ${className ?? ''}`.trim()}
      {...rest}
    >
      <span aria-hidden className={`h-7 w-6 rounded ${checked ? 'bg-accent' : 'bg-muted'}`} />
    </button>
  );
}
