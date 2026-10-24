import type { ReactNode } from 'react';

type Props = {
  /** Optional block before the content (the table setup of Ghi hand). */
  left?: ReactNode;
  /** Column after the content: summary and the main button; stuck to the screen while the page scrolls. */
  aside: ReactNode;
  children: ReactNode;
};

const STICKY = 'lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto';

/**
 * Frame of the screens where the player enters data (session form, Ghi hand, Sửa hand).
 *
 * - Phone: the parts follow each other in one column (`contents`), the page is what it was.
 * - 1024px and up: content with a column on the right that follows the screen and holds the
 *   summary and the main button. With a `left` block (Ghi hand) it sits above the content, in the
 *   same column, because three columns do not fit beside the menu.
 * - 1280px and up: `left` | content | right, three columns.
 *
 * `lg:top-32` leaves room for the bar across the top (56px) and the title bar of a child screen (56px).
 */
export function EntryLayout({ left, aside, children }: Props) {
  return (
    <div
      className={`flex flex-col gap-3 lg:grid lg:items-start lg:gap-6 ${
        left
          ? 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,20rem)] xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_minmax(18rem,22rem)]'
          : 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]'
      }`}
    >
      {left && (
        <div className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:min-w-0 lg:flex-col lg:gap-3 xl:sticky xl:top-32 xl:max-h-[calc(100dvh-9rem)] xl:overflow-y-auto">
          {left}
        </div>
      )}
      <div
        className={`contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3 ${
          left ? 'lg:col-start-1 lg:row-start-2 xl:col-start-2 xl:row-start-1' : ''
        }`}
      >
        {children}
      </div>
      <div
        className={`contents lg:flex lg:flex-col lg:gap-3 ${STICKY} ${
          left ? 'lg:col-start-2 lg:row-span-2 lg:row-start-1 xl:col-start-3 xl:row-span-1' : ''
        }`}
      >
        {aside}
      </div>
    </div>
  );
}
