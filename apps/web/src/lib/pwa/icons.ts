/** App icons served by `app/icons/[name]`. Maskable ones keep the logo inside the safe zone. */
export const ICONS = [
  { name: '192.png', size: 192, maskable: false },
  { name: '512.png', size: 512, maskable: false },
  { name: 'maskable-512.png', size: 512, maskable: true },
] as const;

export const THEME_COLOR = '#0f3d2e';
export const BACKGROUND_COLOR = '#0f3d2e';
