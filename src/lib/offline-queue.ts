/** Offline queue in IndexedDB (browser only): payments recorded without a connection, synced when back online. */
export type QueueItem =
  | { id?: number; kind: "invoicePayment"; label: string; at: string; input: { invoiceId: string; amount: number; mode: string; reference?: string; date?: string } }
  | { id?: number; kind: "munshiPayment"; label: string; at: string; text: string };

const DB = "baaki-offline";
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const QUEUE_EVENT = "baaki-queue";
const changed = () => window.dispatchEvent(new Event(QUEUE_EVENT));

export async function enqueue(item: QueueItem) {
  await tx("readwrite", (s) => s.add(item));
  changed();
}
export const listQueue = () => tx<QueueItem[]>("readonly", (s) => s.getAll() as IDBRequest<QueueItem[]>);
export async function removeItem(id: number) {
  await tx("readwrite", (s) => s.delete(id));
  changed();
}
export const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;
