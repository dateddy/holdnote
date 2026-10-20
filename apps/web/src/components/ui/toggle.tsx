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
      className={`flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-40 ${className ?? ''}`.trim()}
      {...rest}
    >
      <span
        aria-hidden
        className={`flex h-7 w-12 items-center rounded-full border px-1 transition-colors motion-reduce:transition-none ${
          checked ? 'justify-end border-accent bg-accent' : 'justify-start border-line bg-surface'
        }`}
      >
        <span className={`h-5 w-5 rounded-full ${checked ? 'bg-accent-foreground' : 'bg-muted'}`} />
      </span>
    </button>
  );
}
