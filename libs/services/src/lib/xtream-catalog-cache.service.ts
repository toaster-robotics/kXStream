import { Injectable } from '@angular/core';

const DB_NAME = 'kxstream-catalog';
const STORE = 'catalog';
const DB_VERSION = 1;

interface CatalogEntry {
    key: string;
    playlistId: string;
    data: unknown;
    savedAt: number;
}

/**
 * Persists the Xtream catalog (categories + streams) in a dedicated IndexedDB
 * database so it survives reloads/relaunches instead of being re-fetched from
 * the provider on every cold start. Kept separate from the app's main
 * IndexedDB to avoid schema-migration coupling. The catalog stays until the
 * user hits "refresh" on the source (which clears it and re-fetches).
 */
@Injectable({ providedIn: 'root' })
export class XtreamCatalogCacheService {
    private dbPromise: Promise<IDBDatabase> | null = null;

    async get<T>(key: string): Promise<T | null> {
        try {
            const db = await this.openDb();
            return await new Promise<T | null>((resolve) => {
                const request = db
                    .transaction(STORE, 'readonly')
                    .objectStore(STORE)
                    .get(key);
                request.onsuccess = () =>
                    resolve(
                        ((request.result as CatalogEntry | undefined)?.data as
                            | T
                            | undefined) ?? null
                    );
                request.onerror = () => resolve(null);
            });
        } catch {
            return null;
        }
    }

    async set(playlistId: string, key: string, data: unknown): Promise<void> {
        try {
            const db = await this.openDb();
            await new Promise<void>((resolve) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put({
                    key,
                    playlistId,
                    data,
                    savedAt: Date.now(),
                } satisfies CatalogEntry);
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
                tx.onabort = () => resolve();
            });
        } catch {
            // Best-effort cache; ignore write failures (e.g. quota).
        }
    }

    async clearPlaylist(playlistId: string): Promise<void> {
        try {
            const db = await this.openDb();
            await new Promise<void>((resolve) => {
                const tx = db.transaction(STORE, 'readwrite');
                const request = tx
                    .objectStore(STORE)
                    .index('playlistId')
                    .openCursor(IDBKeyRange.only(playlistId));
                request.onsuccess = () => {
                    const cursor = request.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    }
                };
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
                tx.onabort = () => resolve();
            });
        } catch {
            // Ignore; a stale cache is preferable to a thrown error.
        }
    }

    private openDb(): Promise<IDBDatabase> {
        if (this.dbPromise) {
            return this.dbPromise;
        }
        this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error('IndexedDB unavailable'));
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, {
                        keyPath: 'key',
                    });
                    store.createIndex('playlistId', 'playlistId', {
                        unique: false,
                    });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return this.dbPromise;
    }
}
