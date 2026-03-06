import { StateStorage } from 'zustand/middleware';

const DB_NAME = 'aether-4x-db';
const STORE_NAME = 'key-val-store';

export const idbStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const getRequest = store.get(name);

                getRequest.onerror = () => reject(getRequest.error);
                getRequest.onsuccess = () => {
                    resolve(getRequest.result ? getRequest.result.value : null);
                };
            };
            request.onupgradeneeded = () => {
                const db = request.result;
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            };
        });
    },
    setItem: async (name: string, value: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const putRequest = store.put({ key: name, value });

                putRequest.onerror = () => reject(putRequest.error);
                putRequest.onsuccess = () => resolve();
            };
            request.onupgradeneeded = () => {
                const db = request.result;
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            };
        });
    },
    removeItem: async (name: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const deleteRequest = store.delete(name);

                deleteRequest.onerror = () => reject(deleteRequest.error);
                deleteRequest.onsuccess = () => resolve();
            };
            request.onupgradeneeded = () => {
                const db = request.result;
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            };
        });
    },
};
