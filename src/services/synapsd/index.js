'use strict';

// Utils
const EventEmitter = require('eventemitter2');
const path = require('path');
const debug = require('debug')('canvas:service:synapsd');

// App includes
const IndexDB = require('../db');
const VectorDB = require('@lancedb/lancedb');

const BitmapCollection = require('./lib/BitmapCollection.js');

/**
 * SynapsD index class
 */

class SynapsD extends EventEmitter {

    #db;
    #vectordb;

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
        this.#db = new IndexDB(options);
        this.#vectordb = VectorDB.connect(path.join(options.path, 'embeddings'));

        // Initialize in-memory bitmap cache
        this.cache = new Map();

        this.system = new BitmapCollection({
            db: this.#db.createDataset('system'),
            cache: this.cache,
        });

        this.context = new BitmapCollection({
            db: this.#db.createDataset('contexts'),
            cache: this.cache,
        });

        this.feature = new BitmapCollection({
            db: this.#db.createDataset('features'),
            cache: this.cache,
        });

        this.filter = new BitmapCollection({
            db: this.#db.createDataset('filters'),
            cache: this.cache,
        });

    }

    insert(doc, contextArray = [], featureArray = [], filterArray = []) {

    }

    update(doc, contextArray = [], featureArray = [], filterArray = []) {

    }

    delete(doc, contextArray = [], featureArray = [], filterArray = []) {

    }

    find(query, contextArray = [], featureArray = [], filterArray = []) {

    }

    query(query) {

    }

    get(doc) {

    }

    list() {

    }

    has(doc) {

    }

    size() {

    }

    clear() {

    }

    close() {

    }

    /**
     * Features
     */

    tickFeatureArray(doc, featureArray = []) {
    }

    untickFeatureArray(doc, featureArray = []) {

    }

}

module.exports = SynapsD;
