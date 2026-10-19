import type { ButtonHTMLAttributes } from 'react';

/** A whole bar that acts as one button (the context bar of Ghi nhanh). Content is left-aligned. */
export function BarButton({
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`flex min-h-11 w-full items-center gap-2 text-left text-sm ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}
