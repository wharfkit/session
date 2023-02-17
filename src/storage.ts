/**
 * Interface storage adapters should implement.
 *
 * Storage adapters are responsible for persisting [[Session]]s and can optionally be
 * passed to the [[SessionKit]] constructor to auto-persist sessions.
 */
export interface SessionStorage {
    /** Write string to storage at key. Should overwrite existing values without error. */
    write(key: string, data: string): Promise<void>
    /** Read key from storage. Should return `null` if key can not be found. */
    read(key: string): Promise<string | null>
    /** Delete key from storage. Should not error if deleting non-existing key. */
    remove(key: string): Promise<void>
}

export class BrowserLocalStorage implements SessionStorage {
    constructor(readonly keyPrefix: string) {}
    async write(key: string, data: string): Promise<void> {
        localStorage.setItem(this.storageKey(key), data)
    }
    async read(key: string): Promise<string | null> {
        return localStorage.getItem(this.storageKey(key))
    }
    async remove(key: string): Promise<void> {
        localStorage.removeItem(this.storageKey(key))
    }
    storageKey(key: string) {
        return `wharf-${this.keyPrefix}-${key}`
    }
}
