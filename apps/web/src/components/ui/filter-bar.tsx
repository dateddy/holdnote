import type { ReactNode } from 'react';

type Props = {
  /** `row`: one line that scrolls sideways (phone). `column`: stacked (desktop side column). */
  orientation?: 'row' | 'column';
  /** Name of the group for screen readers. */
  label: string;
  children: ReactNode;
};

/**
 * Layout of filter controls: `Segmented`, `ChipMenu` and toggle `Chip`s. In a row, controls keep
 * their width and the bar scrolls sideways; in a column they stack.
 */
export function FilterBar({ orientation = 'row', label, children }: Props) {
  return (
    <div
      role="group"
      aria-label={label}
      className={
        orientation === 'row'
          ? 'flex items-center gap-2 overflow-x-auto [&>*]:shrink-0'
          : 'flex flex-col gap-3'
      }
    >
      {children}
    </div>
  );
}
