import type { LucideIcon } from 'lucide-react';
import { Icon } from './icon';

type Props<T extends string> = {
  value: T;
  /** With `icon`, the option shows only the icon; `label` is its name (screen readers, hover tip). */
  options: readonly { value: T; label: string; icon?: LucideIcon }[];
  onChange: (value: T) => void;
  /** Name of the group for screen readers. */
  label: string;
};

/** One choice out of a few, side by side (Tất cả | Cash | MTT). */
export function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-11 overflow-hidden rounded-xl border border-line bg-surface"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          aria-label={o.icon ? o.label : undefined}
          title={o.icon ? o.label : undefined}
          onClick={() => onChange(o.value)}
          className={`flex min-w-12 flex-auto items-center justify-center px-3 text-sm whitespace-nowrap ${
            o.value === value ? 'bg-accent font-medium text-accent-foreground' : 'text-foreground'
          }`}
        >
          {o.icon ? <Icon icon={o.icon} size={20} /> : o.label}
        </button>
      ))}
    </div>
  );
}
