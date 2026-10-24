import type { TextareaHTMLAttributes } from 'react';

export const TEXTAREA_CLASS =
  'w-full rounded-xl border border-line bg-surface p-3 text-base placeholder:text-muted';

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${TEXTAREA_CLASS} ${className ?? ''}`.trim()} {...rest} />;
}
