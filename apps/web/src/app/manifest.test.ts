import { describe, expect, it } from 'vitest';
import { ICONS } from '@/lib/pwa/icons';
import manifest from './manifest';

describe('web app manifest', () => {
  const m = manifest();

  it('is installable: name, start_url, standalone display', () => {
    expect(m.name).toContain('HoldNote');
    expect(m.short_name).toBe('HoldNote');
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
  });

  it('has 192 and 512 icons plus a maskable one, all served by the icon route', () => {
    const icons = m.icons ?? [];
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
    const names = new Set<string>(ICONS.map((i) => i.name));
    for (const icon of icons) {
      expect(icon.src.startsWith('/icons/')).toBe(true);
      expect(names.has(icon.src.slice('/icons/'.length))).toBe(true);
      // The proxy leaves .png files public; the manifest must not point anywhere it would block.
      expect(icon.src.endsWith('.png')).toBe(true);
    }
  });
});
