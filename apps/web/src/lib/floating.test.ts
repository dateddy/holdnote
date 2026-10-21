import { describe, expect, it } from 'vitest';
import { placeFloating } from './floating';

const viewport = { width: 375, height: 667 };
const at = (left: number, top: number, size = 20) => ({
  left,
  right: left + size,
  top,
  bottom: top + size,
});

describe('placeFloating', () => {
  it('opens below the anchor, centred on it, when there is room', () => {
    const p = placeFloating({
      anchor: at(150, 100),
      viewport,
      width: 224,
      height: 60,
      align: 'center',
    });
    expect(p.side).toBe('below');
    expect(p.left).toBe(160 - 112);
    expect(p.offset).toBe(124);
  });

  it('stays 8px inside the right edge for an icon in the right corner', () => {
    const p = placeFloating({
      anchor: at(350, 100),
      viewport,
      width: 224,
      height: 60,
      align: 'center',
    });
    expect(p.left + p.width).toBe(375 - 8);
  });

  it('stays 8px inside the left edge for an icon at the left', () => {
    const p = placeFloating({
      anchor: at(4, 100),
      viewport,
      width: 224,
      height: 60,
      align: 'center',
    });
    expect(p.left).toBe(8);
  });

  it('flips above when it does not fit below and there is more room above', () => {
    const p = placeFloating({ anchor: at(150, 600), viewport, width: 224, height: 90 });
    expect(p.side).toBe('above');
    expect(p.offset).toBe(667 - 600 + 4);
    expect(p.maxHeight).toBeGreaterThan(400);
  });

  it('stays below when the panel fits, or when above is no better', () => {
    expect(placeFloating({ anchor: at(150, 500), viewport, width: 224, height: 90 }).side).toBe(
      'below',
    );
    expect(placeFloating({ anchor: at(150, 20), viewport, width: 224, height: 900 }).side).toBe(
      'below',
    );
  });

  it('is never wider than the viewport allows', () => {
    const p = placeFloating({
      anchor: at(10, 10),
      viewport: { width: 200, height: 600 },
      width: 224,
      height: 40,
    });
    expect(p.width).toBe(184);
    expect(p.left).toBe(8);
  });
});
