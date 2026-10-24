/** Key under which the desktop menu remembers whether it is open or collapsed. */
export const NAV_KEY = 'holdnote.nav';

type Reader = Pick<Storage, 'getItem'> | null;
type Writer = Pick<Storage, 'setItem'> | null;

/** Open unless the player collapsed it. Storage can be missing or throw (private window): open. */
export function readNavOpen(storage: Reader): boolean {
  try {
    return storage?.getItem(NAV_KEY) !== 'closed';
  } catch {
    return true;
  }
}

export function writeNavOpen(open: boolean, storage: Writer): void {
  try {
    storage?.setItem(NAV_KEY, open ? 'open' : 'closed');
  } catch {
    // The menu still toggles for this visit; it just is not remembered.
  }
}
