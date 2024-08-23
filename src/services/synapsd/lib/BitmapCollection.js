const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const Bitmap = require('./Bitmap');
const { uuid12 } = require('../../../utils/uuid');
const debug = require('debug')('canvas:service:synapsd:BitmapCollection');

class BitmapCollection {

    constructor(store = new Map(), cache = new Map(), options = {
        tag: uuid12(),
        rangeMin: 0,
        rangeMax: 4294967296, // 2^32
    }) {
        this.store = store;
        this.cache = cache;
        this.rangeMin = options.rangeMin;
        this.rangeMax = options.rangeMax;
        this.tag = options.tag;
        debug(`BitmapCollection "${this.tag}" initialized with rangeMin: ${this.rangeMin}, rangeMax: ${this.rangeMax}`);
    }

    /**
     * Bitmap index ops
     */

    getBitmap(key, autoCreateBitmap = false) {
        debug('Getting bitmap', key, 'autoCreateBitmap:', autoCreateBitmap);
        if (this.cache.has(key)) { return this.cache.get(key); }

        const serializedBitmap = this.store.get(key);
        if (!serializedBitmap) {
            debug('Bitmap not found', key);
            return (autoCreateBitmap) ? this.createBitmap(key) : null;
        }

        const bitmap = new Bitmap(RoaringBitmap32.deserialize(serializedBitmap, true), { key, rangeMin: this.rangeMin, rangeMax: this.rangeMax });
        this.cache.set(key, bitmap);
        return bitmap;
    }

    setBitmap(key, bitmap) {
        debug('Storing bitmap', key);
        if (!key) { throw new Error('Key is required'); }
        if (!bitmap) { throw new Error('Bitmap is required'); }
        if (!(bitmap instanceof Bitmap)) { throw new Error('Bitmap must be an instance of Bitmap'); }
        const serializedBitmap = bitmap.serialize(true);
        this.store.put(key, serializedBitmap);
        this.cache.set(key, bitmap);
    }

    createBitmap(key, idArray = []) {
        debug(`Creating bitmap "${key}" with ${idArray.length} objects`);
        const bitmap = new Bitmap(idArray, { key, rangeMin: this.rangeMin, rangeMax: this.rangeMax });
        this.setBitmap(key, bitmap);
        return bitmap;
    }

    renameBitmap(oldKey, newKey) {
        debug(`Renaming bitmap "${oldKey}" to "${newKey}"`);
        const bitmap = this.getBitmap(oldKey);
        if (!bitmap) { return null; }
        this.deleteBitmap(oldKey);
        this.setBitmap(newKey, bitmap.serialize());
        return bitmap;
    }

    deleteBitmap(key) {
        debug(`Deleting bitmap "${key}"`);
        this.cache.delete(key);
        this.store.del(key);
    }


    /**
     * Bitmap operations
     */

    tickSync(key, ids) {
        debug('Ticking', key, ids);
        const bitmap = this.getBitmap(key, true);
        bitmap.addMany(Array.isArray(ids) ? ids : [ids]);
        this.setBitmap(key, bitmap);
        return bitmap;
    }

    untickSync(key, ids) {
        debug('Unticking', key, ids);
        const bitmap = this.getBitmap(key, false);
        if (!bitmap) return null;
        bitmap.removeMany(Array.isArray(ids) ? ids : [ids]);
        this.setBitmap(key, bitmap);
        return bitmap;
    }

    tickManySync(keyArray, ids) {
        debug('Ticking many', keyArray, ids);
        // TODO: Replace with batch operation
        return keyArray.map(key => this.tickSync(key, ids));
    }

    untickManySync(keyArray, ids) {
        debug('Unticking many', keyArray, ids);
        // TODO: Replace with batch operation
        return keyArray.map(key => this.untickSync(key, ids));
    }

    /**
     * Logical operations
     */

    AND(keys) {
        debug('AND', keys);
        if (!Array.isArray(keys)) {
            throw new TypeError(`First argument must be an array of bitmap keys, "${typeof keys}" given`);
        }

        let result = null;
        for (const key of keys) {
            const bitmap = this.getBitmap(key);
            if (bitmap && bitmap.size > 0) {
                if (result === null) { result = bitmap.clone();
                } else { result.andInPlace(bitmap); }
            }
        }

        return result || new this.RoaringBitmap32();
    }


    OR(keys) {
        debug('OR', keys);
        return RoaringBitmap32.orMany(keys.map(key => this.getBitmap(key)).filter(Boolean));
    }

    XOR(keys) {
        debug('XOR', keys);
        return RoaringBitmap32.xorMany(keys.map(key => this.getBitmap(key)).filter(Boolean));
    }


    /**
     * Utils
     */

    listBitmaps() {
        return this.store.getKeys();
    }

    clearCache() {
        this.cache.clear();
    }
}

module.exports = BitmapCollection;
