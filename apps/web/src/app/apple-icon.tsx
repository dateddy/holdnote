import { ImageResponse } from 'next/og';
import { THEME_COLOR } from '@/lib/pwa/icons';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** iOS home-screen icon. Same placeholder logo as the manifest icons. */
export default function AppleIcon() {
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
        fontSize: 112,
        fontWeight: 700,
      }}
    >
      H
    </div>,
    size,
  );
}
