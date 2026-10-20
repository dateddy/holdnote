import type { OpponentStore, QueuedHand, QueuedOpponent, QueueStore } from './queue';

const DB_NAME = 'holdnote';
const HANDS = 'queue';
const OPPONENTS = 'opponents';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDS)) db.createObjectStore(HANDS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(OPPONENTS)) {
        db.createObjectStore(OPPONENTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Run one request in its own transaction and resolve when the transaction is durable. */
async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  make: (s: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = make(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The hand queue in IndexedDB: survives reloads, crashes and a closed tab. */
export const idbStore: QueueStore = {
  put: async (item) => void (await run(HANDS, 'readwrite', (s) => s.put(item))),
  getAll: () => run(HANDS, 'readonly', (s) => s.getAll() as IDBRequest<QueuedHand[]>),
  remove: async (id) => void (await run(HANDS, 'readwrite', (s) => s.delete(id))),
};

/** Opponents made offline wait here until the network lets them through. */
export const idbOpponents: OpponentStore = {
  put: async (item) => void (await run(OPPONENTS, 'readwrite', (s) => s.put(item))),
  getAll: () => run(OPPONENTS, 'readonly', (s) => s.getAll() as IDBRequest<QueuedOpponent[]>),
  remove: async (id) => void (await run(OPPONENTS, 'readwrite', (s) => s.delete(id))),
};
