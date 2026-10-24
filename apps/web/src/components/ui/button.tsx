import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'lg' | 'md';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-foreground font-medium disabled:opacity-40',
  secondary: 'border border-line bg-surface disabled:opacity-40',
  danger: 'bg-loss text-background font-medium disabled:opacity-40',
  ghost: 'text-foreground hover:bg-surface disabled:opacity-40',
};
const SIZE: Record<Size, string> = {
  lg: 'h-14 text-lg',
  md: 'h-12 text-base',
};

/** Class string so links (`<Link className={buttonClass()}>`) and buttons look the same. */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  full = true,
}: { variant?: Variant; size?: Size; full?: boolean } = {}) {
  const shape = `flex items-center justify-center rounded-md px-4 ${SIZE[size]}`;
  return `${shape} ${full ? 'w-full' : ''} ${VARIANT[variant]}`.trim();
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
};

export function Button({ variant, size, full, className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`${buttonClass({ variant, size, full })} ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}
