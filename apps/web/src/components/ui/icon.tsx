import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  /** 20 inline with text, 24 in a bar. */
  size?: 20 | 24;
  className?: string;
};

/**
 * A lucide icon in the current text colour. Decorative: the control that holds it carries the name
 * (`aria-label` or visible text), so the icon is hidden from screen readers.
 */
export function Icon({ icon: Glyph, size = 24, className }: Props) {
  return <Glyph size={size} strokeWidth={2} aria-hidden className={className} />;
}
