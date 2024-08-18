'use strict';

const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const Bitmap = require('./Bitmap');
const { uuid12 } = require('../../../../managers/context/lib/utils');
const debug = require('debug')('canvas:db:index:BitmapCollection');


class BitmapCollection {

    #db;
    #cache;

    /**
     * BitmapCollection constructor
     *
     * @param {*} db
     * @param {*} cache
     * @param {*} options
     */
    constructor(db = new Map(), cache = new Map(), options = {}) {

        const defaultOptions = {
            tag: uuid12(),
            rangeMin: 0,
            rangeMax: 4294967296, // 2^32
        };

        // Merge default options with provided options
        options = { ...defaultOptions, ...options };

        // A suitable DB backend with a Map() like interface
        this.#db = db;
        // A suitable Caching backend with a Map() like interface
        this.#cache = cache; // Not used for now

        // This should probably be implemented one abstraction layer up
        if (typeof options.rangeMin !== 'number' || typeof options.rangeMax !== 'number') {
            throw new TypeError('Invalid range: rangeMin and rangeMax must be numbers');
        }

        this.rangeMin = options.rangeMin;
        this.rangeMax = options.rangeMax;

        this.tag = options.tag;

        debug(`Collection "${this.tag}" initialized with rangeMin: ${this.rangeMin}, rangeMax: ${this.rangeMax}`);
    }


    /**
     * Main BitmapCollection interface (sync)
     */

    tickRow(key, autoCreateBitmap = true, autoSave = true) {

    }

    untickRow(key, autoSave = true) {

    }


    // TODO: Implement proper async methods
    tick(key, idArray, autoCreateBitmap = true, autoSave = true) {
        return this.tickSync(key, idArray, autoCreateBitmap, autoSave);
    }

    tickSync(key, idArray, autoCreateBitmap = true, autoSave = true) {
        let bitmap = this.getBitmap(key, false);
        if (!bitmap) {
            debug(`Bitmap with key ID "${key}" not found`);
            if (!autoCreateBitmap) {
                throw new Error(`Bitmap with key ID "${key}" not found`);
            }

            // Return the newly created bitmap
            return this.createBitmap(key, idArray, autoSave);
        }

        if (typeof idArray === 'number') {
            bitmap.tick(idArray);
        } else {
            bitmap.tickMany(idArray);
        }

        if (autoSave) {
            debug(`Implicit save for bitmap with key ID "${key}"`);
            this.#saveBitmapToDb(key, bitmap);
        }

        return bitmap;
    }

    // TODO: Implement proper async methods
    untick(key, idArray, autoSave = true) {
        return this.untickSync(key, idArray, autoSave);
    }

    untickSync(key, idArray, autoSave = true) {
        let bitmap = this.getBitmap(key);
        if (!bitmap) { return false; } // maybe we should return an empty Bitmap instead

        if (typeof idArray === 'number') {
            bitmap.untick(idArray);
        } else {
            bitmap.untickMany(idArray);
        }

        if (autoSave) {
            debug(`Implicit save for bitmap with key ID "${key}"`);
            this.#saveBitmapToDb(key, bitmap);
        }

        return bitmap;
    }

    // TODO: Implement proper async methods
    tickMany(keyArray, idArray, autoCreateBitmap = true, autoSave = true) {
        return this.tickManySync(keyArray, idArray, autoCreateBitmap, autoSave);
    }

    tickManySync(keyArray, idArray, autoCreateBitmap = true, autoSave = true) {
        if (!Array.isArray(keyArray) || !keyArray.length) {
            throw new TypeError(`First argument must be a non-empty array of bitmap keys, "${typeof keyArray}" given`);
        }

        const results = keyArray.map(key => {
            return this.tickSync(key, idArray, autoCreateBitmap, autoSave);
        });

        return results;
    }

    // TODO: Implement proper async methods
    untickMany(keyArray, idArray, autoSave = true) {
        return this.untickManySync(keyArray, idArray, autoSave);
    }

    untickManySync(keyArray, idArray, autoSave = true) {
        if (!Array.isArray(keyArray) || !keyArray.length) {
            throw new TypeError(`First argument must be a non-empty array of bitmap keys, "${typeof keyArray}" given`);
        }

        const results = keyArray.map(key => {
            return this.untickSync(key, idArray, autoSave);
        });

        return results;
    }

    async untickAll(idArray, autoSave = true) {
        if (typeof idArray === 'number') {
            idArray = [idArray];
        }

        if (!Array.isArray(idArray) || !idArray.length) {
            throw new TypeError(`First argument must be a non-empty array of object IDs, "${typeof idArray}" given`);
        }

        const tasks = [];
        for (const key of this.listBitmaps()) {
            tasks.push(this.untick(key, idArray, autoSave));
        }

        await Promise.all(tasks);
        return true;
    }


    untickAllSync(idArray, autoSave = true) {
        if (typeof idArray === 'number') {
            idArray = [idArray];
        }

        if (!Array.isArray(idArray) || !idArray.length) {
            throw new TypeError(`First argument must be a non-empty array of object IDs, "${typeof idArray}" given`);
        }

        for (const key of this.listBitmaps()) {
            this.untickSync(key, idArray, autoSave);
        }

        return true;
    }


    /**
     * Logical (bitwise) bitmap operations
     */

    AND(keyArray) {
        debug(`${this.tag} -> AND(): keyArray: "${keyArray}"`);
        if (!Array.isArray(keyArray)) {throw new TypeError(`First argument must be an array of bitmap keys, "${typeof keyArray}" given`);}

        let partial;
        for (const key of keyArray) {
            const bitmap = this.getBitmap(key, true);

            // Initialize partial with the first non-empty bitmap
            if (!partial) {
                partial = bitmap;
                continue;
            }
            // Perform AND operation
            partial.andInPlace(bitmap);
        }

        // Return partial or an empty roaring bitmap
        return partial || new RoaringBitmap32();
    }

    // TODO: Properly test, refactor all bitwise methods to be consistent
    OR(keyArray) {
        debug(`${this.tag} -> OR(): keyArray: "${keyArray}"`);
        if (!Array.isArray(keyArray)) {throw new TypeError(`First argument must be an array of bitmap keys, "${typeof keyArray}" given`);}
        // Filter out invalid bitmaps, for OR we are pretty tolerant (for now at least)
        const validBitmaps = keyArray.map(key => this.getBitmap(key)).filter(Boolean);
        return validBitmaps.length ? RoaringBitmap32.orMany(validBitmaps) : new RoaringBitmap32();
    }

    static AND(roaringBitmapArray) {
        debug(`static AND(): roaringBitmapArray(length): "${roaringBitmapArray.length}"`);
        if (!Array.isArray(roaringBitmapArray)) {throw new TypeError(`First argument must be an array of RoaringBitmap32 instances, "${typeof roaringBitmapArray}" given`);}

        let partial;
        for (const bitmap of roaringBitmapArray) {
            debug(bitmap.toArray());
            if (!(bitmap instanceof RoaringBitmap32)) {throw new TypeError(`Bitmap must be an instance of RoaringBitmap32, "${typeof bitmap}" given`);}
            if (!partial) {
                partial = bitmap;
                continue;
            }

            // Perform AND operation
            partial.andInPlace(bitmap);
        }

        // Return partial or an empty roaring bitmap
        return partial || new RoaringBitmap32();

    }

    static OR(roaringBitmapArray) {
        debug(`static OR(): roaringBitmapArray: "${roaringBitmapArray.length}"`);
        if (!Array.isArray(roaringBitmapArray)) {throw new TypeError(`First argument must be an array of RoaringBitmap32 instances, "${typeof roaringBitmapArray}" given`);}
        if (roaringBitmapArray.length === 0) { return new RoaringBitmap32(); }
        return RoaringBitmap32.orMany(roaringBitmapArray);
    }


    /**
     * Utility methods
     */

    listBitmaps() {
        let bitmaps = [...this.#db.keys()];
        return bitmaps;
    }

    getActiveBitmaps() { return this.#cache.list(); }

    clearActiveBitmaps() { this.#cache.clear(); }

    hasBitmap(key) { return this.#db.has(key); }

    getBitmap(key, autoCreateBitmap = true) {
        debug(`${this.tag} -> Getting bitmap with key ID "${key}"`);

        // Return from cache if available
        if (this.#cache.has(key)) {return this.#cache.get(key);}

        // Load from DB
        if (this.hasBitmap(key)) {return this.#loadBitmapFromDb(key);}

        debug(`Bitmap with key ID "${key}" not found in the database`);
        if (!autoCreateBitmap) {return null;}

        let bitmap = this.createBitmap(key);
        if (!bitmap) {throw new Error(`Unable to create bitmap with key ID "${key}"`);}

        return bitmap;
    }

    createBitmap(key, oidArrayOrBitmap = null, autoSave = true) {
        debug(`${this.tag} -> createBitmap(): Creating bitmap with key ID "${key}"`);

        if (this.hasBitmap(key)) {
            debug(`Bitmap with key ID "${key}" already exists`);
            return false;
        }

        const bitmapData = this.#parseInput(oidArrayOrBitmap);
        const bitmap = new Bitmap(bitmapData, {
            type: 'static',
            key: key,
            rangeMin: this.rangeMin,
            rangeMax: this.rangeMax,
        });

        if (autoSave) { this.#saveBitmapToDb(key, bitmap); }
        debug(`Bitmap with key ID "${key}" created successfully`);
        return bitmap;
    }

    removeBitmap(key) {
        debug(`removeBitmap(): Removing bitmap with key ID "${key}"`);
        if (!this.#db.has(key)) {
            debug(`Bitmap with key ID "${key}" not found`);
            return false;
        }

        // TODO: Add error handling
        this.#cache.delete(key);
        this.#db.delete(key); // TODO: this is sync, and a Map like wrapper function only, we should also implement proper async methods
        return true;
    }

    renameBitmap(key, newKey, autoSave = true) {
        debug(`renameBitmap(): Renaming bitmap with key ID "${key}" to "${newKey}"`);
        if (!this.#db.has(key)) {
            debug(`Bitmap with key ID "${key}" not found`);
            return false;
        }

        let bitmap = this.getBitmap(key, false);
        if (!this.createBitmap(newKey, bitmap, autoSave)) {
            throw new Error(`Unable to create bitmap with key ID "${newKey}"`);
        }

        if (!this.removeBitmap(key)) {
            throw new Error(`Unable to remove bitmap with key ID "${key}"`);
        }

        debug(`Bitmap with key ID "${key}" renamed to "${newKey}"`);
        return true;
    }

    updateBitmap(key, oidArrayOrBitmap, autoSave = true) {
        debug(`updateBitmap(): Updating bitmap with key ID "${key}"`);
        if (!this.#db.has(key)) {
            debug(`Bitmap with key ID "${key}" not found`);
            return false;
        }

        let bitmap = this.getBitmap(key, false);
        let newBitmap = this.AND([bitmap, oidArrayOrBitmap]);
    }


    /**
     * Internal methods (sync, using a Map() like interface)
     */

    #parseInput(input) {
        if (!input) {
            debug('Creating new empty bitmap');
            return new RoaringBitmap32();
        } else if (input instanceof RoaringBitmap32) {
            debug(`RoaringBitmap32 supplied as input with ${input.size} elements`);
            return input;
        } else if (Array.isArray(input)) {
            debug(`OID Array supplied as input with ${input.length} elements`);
            return new RoaringBitmap32(input);
        } else if (typeof input === 'number') {
            return input;
        } else {
            throw new TypeError(`Invalid input type: ${typeof input}`);
        }
    }

    #saveBitmapToDb(key, bitmap/*, overwrite = true */) {
        debug(`Saving bitmap with key ID "${key}" to the database`);
        if (!(bitmap instanceof RoaringBitmap32)) {throw new TypeError('Input must be an instance of RoaringBitmap32');}
        // TODO: runOptimize()
        // TODO: shrinkToFit()
        // TODO: Overwrite logic

        let bitmapData = bitmap.serialize(true);
        try {
            this.#db.set(key, bitmapData);
        } catch (err) {
            throw new Error(`Unable to save bitmap ${key} to database`);
        }
    }

    #loadBitmapFromDb(key) {
        debug(`Loading bitmap with key ID "${key}" from the database`);
        let bitmapData = this.#db.get(key);
        if (!bitmapData) {
            debug(`Unable to load bitmap "${key}" from the database`);
            return null;
        }

        let bitmap = new RoaringBitmap32();
        return Bitmap.create(bitmap.deserialize(bitmapData, true), {
            type: 'static',
            key: key,
            rangeMin: this.rangeMin,
            rangeMax: this.rangeMax,
        });
    }

}

module.exports = BitmapCollection;

