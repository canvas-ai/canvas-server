// Utils
const EE = require('eventemitter2');
const debug = require('debug')('canvas:db:index');

// App includes
const BitmapCollection = require('../../../services/synapsd/lib/BitmapCollection');
const MemCache = require('./lib/MemCache');

// Constants
//const MAX_DOCUMENTS = 4294967296 // 2^32
//const MAX_CONTEXTS = 1024 // 2^10
//const MAX_FEATURES = 65536 // 2^16
//const MAX_FILTERS = 65536 // 2^16
const INTERNAL_BITMAP_ID_MIN = 1000;
const INTERNAL_BITMAP_ID_MAX = 1000000;


/**
 * Main index class
 */

class Index extends EE {


    #db;
    #epoch = 'e0';   // 2^32 bitmap limit

    constructor(options = {}) {

        // Initialize event emitter
        super(options.eventEmitter || {});

        // Bind/initialize the database backend
        this.#db = options.db;

        // Bitmaps
        this.bitmaps = this.#db.createDataset('bitmaps');
        this.bitmapCache = new MemCache(); // Shared Map() to cache bitmaps in memory

        // HashMap(s)
        // To decide whether to use a single dataset with a hash type prefix
        // sha1/<hash> | oid
        // md5/<hash> | oid
        // or a separate dataset per hash type
        this.hash2oid = this.#db.createDataset('hash2oid');

        // Internal Bitmaps
        this.bmInternal = new BitmapCollection(
            this.bitmaps.createDataset('internal'),
            this.bitmapCache,
            {
                tag: 'internal',
                rangeMin: INTERNAL_BITMAP_ID_MIN,
                rangeMax: INTERNAL_BITMAP_ID_MAX,
            });

        // Contexts
        this.bmContexts = new BitmapCollection(
            this.bitmaps.createDataset('contexts'),
            this.bitmapCache,
            {
                tag: 'contexts',
                rangeMin: INTERNAL_BITMAP_ID_MAX + 1,
            });

        // Features
        this.bmFeatures = new BitmapCollection(
            this.bitmaps.createDataset('features'),
            this.bitmapCache,
            {
                tag: 'features',
                rangeMin: INTERNAL_BITMAP_ID_MAX + 1,
            });

        // Filters
        this.bmFilters = new BitmapCollection(
            this.bitmaps.createDataset('filters'),
            this.bitmapCache,
            {
                tag: 'filters',
                rangeMin: INTERNAL_BITMAP_ID_MAX + 1,
            });

        // Queues
        // TODO

        // Timeline
        // <timestamp> | <action> | diff {path: [bitmap IDs]}
        // Action: create, update, delete
        // TODO

    }

    /**
     * Main Index API
     */

    async clear(id, hash) {
        if (!id) {throw new Error('Document ID required');}
        if (!Number.isInteger(id)) {throw new Error('Document ID must be an integer');}

        if (!hash) {throw new Error('Document hash required');}
        if (typeof hash !== 'string') {throw new Error('Document hash must be a string');}

        // Clear hashmaps
        await this.hash2oid.remove(hash);

        // Clear all bitmaps in parallel
        const clearTasks = [
            this.bmInternal.untickAll(id),
            this.bmContexts.untickAll(id),
            this.bmFeatures.untickAll(id),
            this.bmFilters.untickAll(id),
        ];

        await Promise.all(clearTasks);
    }

    /*
    async getObject(id) { }

    async getObjectByHash(hash) { }

    async insertObject(id, contextArray, featureArray, filterArray) {}

    async updateObject(id, contextArray, featureArray, filterArray) {}

    async removeObject(id, contextArray, featureArray, filterArray) {}



    async getObjectContexts(id) { }

    async addObjectFeatures(id, feature) { }

    async removeObjectFeatures(id, feature) { }

    async getObjectFeatures(id) { } */



    /**
     * Bitmap methods
     */

    async tickContextArray(idOrArray, contextArray = []) {
        if (!idOrArray) {throw new Error('Document ID required');}
        if (!contextArray || !contextArray.length) {throw new Error('Context array required');}

        if (typeof idOrArray === 'number') {
            return this.bmContexts.tick(idOrArray, contextArray);
        }

        return this.bmContexts.tickMany(idOrArray, contextArray);
    }

    async untickContextArray(idOrArray, contextArray) {
        if (!idOrArray) {throw new Error('Document ID required');}
        if (contextArray.length < 1) {
            throw new Error('Context array required');
        }

        if (typeof idOrArray === 'number') {
            await this.bmContexts.untick(idOrArray, contextArray);
        } else {
            await this.bmContexts.untickMany(idOrArray, contextArray);
        }
    }

    async tickFeatureArray(idOrArray, featureArray = []) {
        if (!idOrArray) {throw new Error('Document ID required');}
        if (!featureArray || !featureArray.length) {throw new Error('Feature array required');}

        if (typeof idOrArray === 'number') {
            return this.bmFeatures.untick(idOrArray, featureArray);
        }

        return this.bmFeatures.untickMany(idOrArray, featureArray);
    }

    async untickFeatureArray(idOrArray, featureArray = []) {
        if (!idOrArray) {throw new Error('Document ID required');}
        if (!featureArray || !featureArray.length) {throw new Error('Feature array required');}

        if (typeof idOrArray === 'number') {
            return this.bmFeatures.untick(idOrArray, featureArray);
        }

        return this.bmFeatures.untickMany(idOrArray, featureArray);
    }

    updateContextBitmaps(bitmapArray, oidOrArray) {
        debug(`updateContextBitmaps(): contextArray: ${bitmapArray}, oidOrArray: ${oidOrArray}`);
        if (!Array.isArray(bitmapArray)) {throw new Error(`bitmapArray must be an array, got: ${typeof bitmapArray}`);}
        if (!bitmapArray.length) {throw new Error('bitmapArray array is empty');}
        return this.bmContexts.tickMany(bitmapArray, oidOrArray);
    }

    updateFeatureBitmaps(bitmapArray, oidOrArray) {
        debug(`updateFeatureBitmaps(): featureArray: "${bitmapArray}", oidOrArray: "${oidOrArray}"`);
        if (!Array.isArray(bitmapArray)) {throw new Error(`bitmapArray must be an array, got: ${typeof bitmapArray}`);}
        if (!bitmapArray.length) {throw new Error('bitmapArray array is empty');}
        return this.bmFeatures.tickMany(bitmapArray, oidOrArray);
    }

    // TODO: Remove/refactor
    bitmapAND(bitmapArray, returnAsArray = false) {
        debug(`bitmapAND(): bitmapArray: "${bitmapArray}", returnAsArray: ${returnAsArray}`);
        if (!Array.isArray(bitmapArray)) {throw new Error(`bitmapArray must be an array, got: ${typeof bitmapArray}`);}
        if (!bitmapArray.length) {throw new Error('bitmapArray array is empty');}
        const result = BitmapCollection.AND(bitmapArray);
        debug(`bitmapAND(): result: ${result.toArray()}`);
        return returnAsArray ? result.toArray() : result;
    }

    // TODO: Remove/refactor
    contextArrayAND(bitmapArray, returnAsArray = false) {
        debug(`contextArrayAND(): bitmapArray: "${bitmapArray}", returnAsArray: ${returnAsArray}`);
        if (!Array.isArray(bitmapArray)) {throw new Error(`bitmapArray must be an array, got: ${typeof bitmapArray}`);}
        if (!bitmapArray.length) {throw new Error('bitmapArray array is empty');}
        const result = this.bmContexts.AND(bitmapArray);
        debug(`contextArrayAND(): result: ${result.toArray()}`);
        return returnAsArray ? result.toArray() : result;
    }

    // TODO: Remove/refactor
    featureArrayAND(bitmapArray, returnAsArray = false) {
        debug(`featureArrayAND(): bitmapArray: ${bitmapArray}, returnAsArray: ${returnAsArray}`);
        if (!Array.isArray(bitmapArray)) {throw new Error(`bitmapArray must be an array, got: ${typeof bitmapArray}`);}
        if (!bitmapArray.length) {throw new Error('bitmapArray array is empty');}
        const result = this.bmFeatures.AND(bitmapArray);
        debug(`featureArrayAND(): result: ${result.toArray()}`);
        return returnAsArray ? result.toArray() : result;
    }

}

module.exports = Index;
