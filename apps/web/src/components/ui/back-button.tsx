'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { navHistory } from '@/lib/nav-history';
import { Icon } from './icon';

type Props = {
  /** Parent screen, used when the screen was opened directly and there is no history to go back to. */
  href: string;
  /** Accessible name, e.g. "Quay lại". */
  label: string;
};

/**
 * The `<` at the left of a child screen's top bar. It goes back through the browser history, so
 * it and the Android back button do the same thing; with no history it goes to the parent screen.
 */
export function BackButton({ href, label }: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      data-back-button
      onClick={() => (navHistory.canGoBack() ? router.back() : router.replace(href))}
      className="flex size-11 shrink-0 items-center justify-center rounded-md"
    >
      <Icon icon={ChevronLeft} />
    </button>
  );
}
