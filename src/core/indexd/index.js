// Utils
const debug = require('debug')('canvas:db');
const EventEmitter = require('eventemitter2');

// App includes
const Db = require('../db/index.js').lmdb;
const MemCache = require('./lib/MemCache.js');
const BitmapCollection = require('./lib/BitmapCollection.js');

// Constants
const INTERNAL_BITMAP_ID_MIN = 1000;
const INTERNAL_BITMAP_ID_MAX = 1000000;


/**
 * Canvas index class
 */

class IndexD extends EventEmitter {

    #indexes;
    #db;

    constructor(options = {
        backupOnOpen: false,
        backupOnClose: false,
        compression: true,
        eventEmitter: {},
    }) {
        // Event emitter
        super(options.eventEmitter);

        // Initialize database backend
        if (!options.path) { throw new Error('Database path required'); }
        this.#db = new Db(options);

        // Initialize in-memory bitmap cache
        this.cache = new Map();

        this.system = new BitmapCollection({
            db: this.#db.createDataset('system'),
            cache: this.cache,
        });

        this.contexts = new BitmapCollection({
            db: this.#db.createDataset('contexts'),
            cache: this.cache,
        });

        this.features = new BitmapCollection({
            db: this.#db.createDataset('features'),
            cache: this.cache,
        });

        this.filters = new BitmapCollection({
            db: this.#db.createDataset('filters'),
            cache: this.cache,
        });

    }

    /*
    index.tree
    index.layers

    index.sessions

    index.devices
    index.apps
    index.roles
    index.identities

    ? index.users
    */
    createIndex(name, backend) { }

    listIndexes() {}

    hasIndex(name) {}

    openIndex(name) {}

    createBitmap(name) {

    }

    clearBitmap(name) { }

    insertObject(hashmapArray, bitmapArray) { }

}


module.exports = IndexD;

