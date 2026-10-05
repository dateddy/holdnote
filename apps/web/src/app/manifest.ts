import type { MetadataRoute } from 'next';
import { BACKGROUND_COLOR, ICONS, THEME_COLOR } from '@/lib/pwa/icons';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HoldNote — Sổ Tay Hand',
    short_name: 'HoldNote',
    description: 'Nhật ký học poker: ghi hand dưới 30 giây, AI review, theo dõi leak.',
    lang: 'vi',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    icons: ICONS.map((i) => ({
      src: `/icons/${i.name}`,
      sizes: `${i.size}x${i.size}`,
      type: 'image/png',
      purpose: i.maskable ? 'maskable' : 'any',
    })),
  };
}
