import { ImageResponse } from 'next/og';
import { ICONS, THEME_COLOR } from '@/lib/pwa/icons';

export function generateStaticParams() {
  return ICONS.map((i) => ({ name: i.name }));
}

/** Placeholder logo: a white "H" on poker-table green. Replace with real artwork later. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const icon = ICONS.find((i) => i.name === name);
  if (!icon) return new Response('Not found', { status: 404 });

  // Maskable icons get cropped to a circle or squircle: keep the letter in the middle 60%.
  const fontSize = Math.round(icon.size * (icon.maskable ? 0.42 : 0.62));
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: THEME_COLOR,
        color: '#ffffff',
        fontSize,
        fontWeight: 700,
      }}
    >
      H
    </div>,
    { width: icon.size, height: icon.size },
  );
}
