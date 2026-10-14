import type { InputHTMLAttributes } from 'react';

export const INPUT_CLASS =
  'h-12 w-full rounded-md border border-line bg-surface px-3 text-base placeholder:text-muted';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${INPUT_CLASS} ${className ?? ''}`.trim()} {...rest} />;
}
