import type { ReactNode } from 'react';

type Props = {
  label: string;
  /** This column is the one the table is sorted by. */
  active: boolean;
  dir: 'asc' | 'desc';
  onSort: () => void;
  align?: 'left' | 'right';
  /** An `InfoTip` beside the name; it stays outside the sort button. */
  tip?: ReactNode;
};

/** Column header `<th>` whose name sorts the table. */
export function SortHeader({ label, active, dir, onSort, align = 'left', tip }: Props) {
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-1 text-xs font-medium whitespace-nowrap text-muted ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={onSort}
          className={`inline-flex h-9 items-center gap-1 ${active ? 'text-foreground' : ''}`}
        >
          {label}
          <span aria-hidden className="w-2">
            {active ? (dir === 'asc' ? '▲' : '▼') : ''}
          </span>
        </button>
        {tip}
      </span>
    </th>
  );
}
