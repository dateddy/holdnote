import type { ButtonHTMLAttributes } from 'react';

export type TabTone = 'ok' | 'invalid' | 'locked';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role'> & {
  /** `ok`: done or to act (green), `invalid`: has actions that no longer fit (red, dashed), `locked`: not reached. */
  tone: TabTone;
  /** The tab whose content is showing: filled. */
  selected: boolean;
};

/** One tab of a row, e.g. a street. Text only, no icon. */
export function Tab({ tone, selected, className, type = 'button', ...rest }: Props) {
  const look =
    tone === 'locked'
      ? 'border-line bg-surface opacity-40'
      : tone === 'invalid'
        ? selected
          ? 'border-loss bg-loss text-background'
          : 'border-dashed border-loss bg-surface text-loss'
        : selected
          ? 'border-accent bg-accent text-accent-foreground'
          : 'border-accent bg-surface';
  return (
    <button
      type={type}
      role="tab"
      aria-selected={selected}
      disabled={tone === 'locked'}
      className={`flex h-11 min-w-0 flex-1 items-center justify-center rounded-md border px-1 text-sm ${look} ${
        className ?? ''
      }`.trim()}
      {...rest}
    />
  );
}
