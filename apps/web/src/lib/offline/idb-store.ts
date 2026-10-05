import type { QueuedHand, QueueStore } from './queue';

const DB_NAME = 'holdnote';
const STORE = 'queue';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Run one request in its own transaction and resolve when the transaction is durable. */
async function run<T>(mode: IDBTransactionMode, make: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = make(tx.objectStore(STORE));
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
  put: async (item) => void (await run('readwrite', (s) => s.put(item))),
  getAll: () => run('readonly', (s) => s.getAll() as IDBRequest<QueuedHand[]>),
  remove: async (id) => void (await run('readwrite', (s) => s.delete(id))),
};
