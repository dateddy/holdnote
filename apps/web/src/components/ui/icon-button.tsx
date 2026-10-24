import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  /** One or two characters such as `<>`, `‹`, `›`, or an `<Icon>`. */
  glyph: ReactNode;
  /** Required: the glyph alone says nothing to a screen reader. */
  label: string;
};

/** Square 44px button that holds a single glyph. */
export function IconButton({ glyph, label, className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-lg disabled:opacity-40 ${
        className ?? ''
      }`.trim()}
      {...rest}
    >
      {glyph}
    </button>
  );
}
