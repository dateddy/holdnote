/**
 * How many screens of the app are behind the current one in this page load. The back arrow goes
 * through the browser history (so the Android back button and the arrow agree) only when there is
 * one; a screen opened directly (a reload, a link, a cold start of the installed app) goes to its
 * parent instead.
 */
export type NavHistory = {
  /** Call on every change of path; `popped` is true when it came from Back or Forward. */
  visit(path: string, popped: boolean): void;
  canGoBack(): boolean;
};

export function createNavHistory(): NavHistory {
  let depth = 0;
  let last: string | null = null;
  return {
    visit(path, popped) {
      if (last === null) {
        last = path;
        return;
      }
      if (path === last) return;
      last = path;
      depth = popped ? Math.max(0, depth - 1) : depth + 1;
    },
    canGoBack: () => depth > 0,
  };
}

/** The one history of the page load. */
export const navHistory = createNavHistory();

/**
 * A swipe that starts at the left edge and runs mostly sideways: close to the edge, long enough,
 * and flatter than it is long.
 */
export function isEdgeSwipe(
  start: { x: number; y: number },
  end: { x: number; y: number },
  { edge = 20, minDx = 60, maxSlope = 0.6 } = {},
): boolean {
  const dx = end.x - start.x;
  const dy = Math.abs(end.y - start.y);
  return start.x <= edge && dx >= minDx && dy <= dx * maxSlope;
}
