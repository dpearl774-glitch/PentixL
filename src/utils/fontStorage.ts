/**
 * Long-term storage for imported font files.
 *
 * A FontFace only exists while the page is open, so a font that merely saves
 * its family name comes back as a fallback after a refresh. The raw font bytes
 * are kept in their own IndexedDB database and re-registered on every boot,
 * which makes imported typefaces a permanent part of the app.
 */
const DB_NAME = 'pentix_fonts_db';
const DB_VERSION = 1;
const STORE_NAME = 'fonts';

export interface StoredFont {
  family: string;
  /** Font file bytes as stored, ready to feed to a new FontFace */
  data: ArrayBuffer;
  addedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'family' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Persist a font file under its family name (overwrites any previous bytes). */
export async function saveFont(family: string, data: ArrayBuffer): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ family, data, addedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Every stored font, newest first. */
export async function loadAllFonts(): Promise<StoredFont[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const rows = (request.result as StoredFont[]) || [];
        rows.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        resolve(rows);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/** Forget a font the user removed from their library. */
export async function deleteFont(family: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(family);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* nothing stored to remove */
  }
}
