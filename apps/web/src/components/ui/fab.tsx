import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Icon } from './icon';

/**
 * Floating action button at the bottom right: the one way to start something on a list screen
 * ("Phiên mới"). On a phone it floats above the tab bar, on desktop above the corner of the page.
 */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex h-14 items-center gap-2 rounded-xl bg-accent px-5 text-lg font-medium text-accent-foreground shadow-lg lg:right-8 lg:bottom-8"
    >
      <Icon icon={Plus} />
      {label}
    </Link>
  );
}
