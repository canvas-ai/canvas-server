'use strict';

// Utils
const EventEmitter = require('eventemitter2');
const path = require('path');
const debug = require('debug')('canvas:service:synapsd');

// Services
const Db = require('../db');

// App includes
const VectorDB = require('@lancedb/lancedb');
const BitmapCollection = require('./lib/BitmapCollection.js');

// Constants
const INTERNAL_BITMAP_ID_MIN = 1000;
const INTERNAL_BITMAP_ID_MAX = 1000000;



/**
 * Simplified SynapsD index class
 */

class SynapsD extends EventEmitter {

    #db;

    constructor(options = {
        backupOnOpen: false,
        backupOnClose: false,
        compression: true,
        eventEmitter: {},
    }) {
        // Event emitter
        super(options.eventEmitter);

        // Initialize database backends
        if (!options.path) { throw new Error('Database path required'); }
        this.#db = new Db(options);

        // Initialize in-memory bitmap cache
        this.cache = new Map();

        // Initialize system bitmap collection
        this.system = new BitmapCollection({
            db: this.#db.createDataset('system'),
            cache: this.cache,
        });

        // Initialize hashmaps
        this.hashmaps = this.#db.createDataset('hashmaps');

        // Initialize global bitmap collection
        this.bitmaps = new BitmapCollection({
            db: this.#db.createDataset('bitmaps'),
            cache: this.cache,
        });

        // RAG
        this.chunks = this.#db.createDataset('chunks');
        this.embeddings = VectorDB.connect(path.join(options.path, 'embeddings'));

        debug('SynapsD initialized');
    }

    /*
    createIndex(name, backend) { }

    listIndexes() {}

    hasIndex(name) {}

    openIndex(name) {}

    createBitmap(name) {}

    clearBitmap(name) {}

    index.tree
    index.layers

    index.sessions

    index.devices
    index.apps
    index.roles
    index.identities

    ? index.users

    context/<layerid>
    feature/<mime/type/application/json>
    custom/<tag>/<foo>
    */


    insert(doc, bitmapArray = []) {

    }

    update(doc, bitmapArray = []) {

    }

    remove(id, bitmapArray = []) {

    }

    delete(id) {

    }

    get(id) {

    }

    list(andArray = [], orArray = [], filterArray = []) {

    }

    has(id, andArray = [], orArray = [], filterArray = []) {


    find(query, andArray = [], orArray = [], filterArray = []) {

    }

    query(query) {}


    /**
     * Metadata document schemas
     */

    listSchemas() {

    }

    getSchema(name) {

    }

}

module.exports = SynapsD;
