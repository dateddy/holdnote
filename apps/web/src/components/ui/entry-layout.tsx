import type { ReactNode } from 'react';

type Props = {
  /** Optional column before the content (the table setup of Ghi hand). */
  left?: ReactNode;
  /** Column after the content: summary and the main button; stuck to the screen while the page scrolls. */
  aside: ReactNode;
  children: ReactNode;
};

/**
 * Frame of the screens where the player enters data (session form, Ghi hand, Sửa hand). From
 * 1024px: [left] · content · a column on the right that follows the screen and holds the summary
 * and the main button. On a phone the three simply follow each other (`contents`), so the page is
 * the same single column as before and the main button sits where the screen already puts it.
 * `lg:top-32` leaves room for the bar across the top (56px) and the title bar of a child screen (56px).
 */
export function EntryLayout({ left, aside, children }: Props) {
  return (
    <div
      className={`flex flex-col gap-3 lg:grid lg:items-start lg:gap-6 ${
        left
          ? 'lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_minmax(18rem,22rem)]'
          : 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]'
      }`}
    >
      {left && <div className={STICKY}>{left}</div>}
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3">{children}</div>
      <div className={STICKY}>{aside}</div>
    </div>
  );
}

const STICKY =
  'contents lg:sticky lg:top-32 lg:flex lg:max-h-[calc(100dvh-9rem)] lg:flex-col lg:gap-3 lg:overflow-y-auto';
