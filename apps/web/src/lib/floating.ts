export type Box = { left: number; right: number; top: number; bottom: number };

export type Placement = {
  /** Where the panel's left edge goes. */
  left: number;
  width: number;
  /** Which side of the anchor the panel opens on. */
  side: 'below' | 'above';
  /** Distance from the top of the viewport (below) or from its bottom (above). */
  offset: number;
  maxHeight: number;
};

const GAP = 4;
const MARGIN = 8;

/**
 * Where a small panel goes next to its anchor: horizontally centred on the anchor or starting at
 * its left edge, kept 8px inside the viewport; below the anchor, or above it when the panel does
 * not fit below and there is more room above. `height` is the panel's own height (0 = unknown yet).
 */
export function placeFloating({
  anchor,
  viewport,
  width,
  height,
  align = 'start',
}: {
  anchor: Box;
  viewport: { width: number; height: number };
  width: number;
  height: number;
  align?: 'start' | 'center';
}): Placement {
  const w = Math.min(width, viewport.width - 2 * MARGIN);
  const wanted = align === 'center' ? (anchor.left + anchor.right) / 2 - w / 2 : anchor.left;
  const left = Math.min(Math.max(MARGIN, wanted), viewport.width - w - MARGIN);

  const below = viewport.height - anchor.bottom - GAP - MARGIN;
  const above = anchor.top - GAP - MARGIN;
  const flip = height > below && above > below;
  return flip
    ? {
        left,
        width: w,
        side: 'above',
        offset: viewport.height - anchor.top + GAP,
        maxHeight: Math.max(120, above),
      }
    : {
        left,
        width: w,
        side: 'below',
        offset: anchor.bottom + GAP,
        maxHeight: Math.max(120, below),
      };
}
