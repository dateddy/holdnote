type Props<T extends string> = {
  value: T;
  options: readonly { value: T; label: string }[];
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
      className="flex h-11 overflow-hidden rounded-md border border-line bg-surface"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-w-16 flex-auto px-3 text-sm whitespace-nowrap ${
            o.value === value ? 'bg-accent font-medium text-accent-foreground' : 'text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
