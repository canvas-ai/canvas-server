import { createStorage, defineDriver } from 'unstorage';
import { open } from 'lmdb';

// Create LMDB driver for unstorage
const lmdbDriver = defineDriver((options) => {
    const db = open({ path: './server/db/auth' });

    return {
        name: 'lmdb-driver',
        options,
        async hasItem(key) {
            return db.doesExist(key);
        },
        async getItem(key) {
            return db.get(key);
        },
        async setItem(key, value) {
            return db.put(key, value);
        },
        async removeItem(key) {
            return db.remove(key);
        },
        async getKeys(base = '') {
            const keys = [];
            db.getKeys({ prefix: base }).forEach(key => keys.push(key));
            return keys;
        },
        async clear(base = '') {
            const keys = await this.getKeys(base);
            for (const key of keys) {
                await this.removeItem(key);
            }
        },
        async dispose() {
            await db.close();
        },
        async watch(callback) {
            // LMDB doesn't support watching, so we'll just return a no-op
            return () => {};
        }
    };
});

// Create storage instance
const storage = createStorage({
    driver: lmdbDriver()
});

export default storage;
