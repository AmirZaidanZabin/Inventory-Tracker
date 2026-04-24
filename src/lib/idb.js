/**
 * Minimal IndexedDB Wrapper for client-side caching
 */
export const idb = {
    dbName: 'PicoInventoryDB',
    storeName: 'cacheStore',
    db: null,

    init: async function() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = (e) => reject("IndexedDB error: " + e.target.error);
            
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    },

    set: async function(key, val) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.put(val, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    get: async function(key) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    pushToQueue: async function(item) {
        let queue = await this.get('syncQueue') || [];
        queue.push(item);
        await this.set('syncQueue', queue);
    },

    getQueue: async function() {
        return await this.get('syncQueue') || [];
    },

    clearQueue: async function() {
        await this.set('syncQueue', []);
    }
};
