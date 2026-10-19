/**
 * Scroll the page just enough that `el` ends above the save bar (and below the sticky context bar).
 * `scrollIntoView({ block: 'nearest' })` is no use here: browsers skip it when the element is already
 * visible, even if the fixed save bar covers its lower part.
 */
export function revealAboveBar(el: HTMLElement | null, reserved = 112, top = 48): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const over = r.bottom - (window.innerHeight - reserved);
  if (over > 0) window.scrollBy({ top: Math.min(over, Math.max(0, r.top - top)) });
}
