import type { HTMLAttributes } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & { open: boolean };

/**
 * Area that opens in the page flow (no overlay, no dimming): the mini table, the card picker, the
 * number pad. Closed content is hidden and cannot be focused.
 */
export function Collapse({ open, className, children, ...rest }: Props) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-150 motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      } ${className ?? ''}`.trim()}
      inert={!open}
      {...rest}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
