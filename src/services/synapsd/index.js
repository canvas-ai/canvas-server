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

// Schemas (temporary implementation, MVP)
const DOCUMENT_SCHEMAS = new Map();
DOCUMENT_SCHEMAS.set('data/abstraction/document', require('../../schemas/data/BaseDocument.js'));
DOCUMENT_SCHEMAS.set('data/abstraction/file', require('../../schemas/data/abstractions/File.js'));
DOCUMENT_SCHEMAS.set('data/abstraction/note', require('../../schemas/data/abstractions/Note.js'));
DOCUMENT_SCHEMAS.set('data/abstraction/tab', require('../../schemas/data/abstractions/Tab.js'));
DOCUMENT_SCHEMAS.set('data/abstraction/todo', require('../../schemas/data/abstractions/Todo.js'));
DOCUMENT_SCHEMAS.set('data/abstraction/app', require('../../schemas/data/abstractions/App.js'));


/**
 * SynapsD index class
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

        // Main document store
        this.documents = this.#db.createDataset('documents'); // id -> document

        // Initialize hashmaps
        this.hashmaps = this.#db.createDataset('checksums'); // algo/checksum -> id

        // Initialize bitmap store
        this.bitmaps = this.#db.createDataset('bitmaps');

        // Initialize bitmap collection
        this.contexts = new BitmapCollection(
            this.bitmaps,
            this.cache,
            {
                tag: 'contexts',
                rangeMin: INTERNAL_BITMAP_ID_MIN,
                rangeMax: INTERNAL_BITMAP_ID_MAX,
            });

        this.features = new BitmapCollection(
            this.bitmaps,
            this.cache,
            {
                tag: 'features',
                rangeMin: INTERNAL_BITMAP_ID_MIN,
                rangeMax: INTERNAL_BITMAP_ID_MAX,
            });

        // RAG
        this.chunks = this.#db.createDataset('chunks');
        this.embeddings = VectorDB.connect(path.join(options.path, 'embeddings'));

        debug('SynapsD initialized');
    }

    async insert(document, contextArray = [], featureArray = []) {
        debug('Inserting document', document);
        if (!(document instanceof DOCUMENT_SCHEMAS.get('data/abstraction/document'))) {
            throw new Error('Invalid document type');
        }

        if (!document.validate()) {
            throw new Error('Invalid document');
        }

        let primaryChecksum = document.getChecksum(); //document.checksums.get(document.index.primaryChecksumAlgorithm);
        if (!primaryChecksum) { throw new Error('Document primary checksum not found'); }

        let existingId = await this.findIdByChecksum(document.index.primaryChecksumAlgorithm, primaryChecksum);
        if (existingId) {
            debug(`Document already exists: ${existingId}`);
            return this.update(document, contextArray, featureArray);
        }

        // Insert document to database
        await this.documents.put(document.id, document); //document.toJSON()

        // Update hashmaps
        await this.insertChecksum(document.index.primaryChecksumAlgorithm, primaryChecksum, document.id);

        // Update bitmaps
        this.contexts.tickManySync(contextArray, document.id);
        this.features.tickManySync(featureArray, document.id);

        // Emit event
        this.emit('index:insert', document.id);

        // Return document.id
        return document.id;

    }

    async update(doc, bitmapArray = []) {
        
    }

    async remove(id, bitmapArray = []) {

    }

    async delete(id) {

    }

    async get(id) {

    }

    async list(andArray = [], orArray = [], filterArray = []) {
        let bitmapArray = await this.bitmaps.getMany(andArray);
        if (bitmapArray.length === 0) { return []; }
        let idArray = [];
        let resultBitmap;
        resultBitmap = this.contexts.AND(andArray);
        idArray = resultBitmap.toArray();
//        for (let bitmap of bitmapArray) {}
        return idArray;


    }

    async has(id, andArray = [], orArray = [], filterArray = []) {

    }

    async find(query, andArray = [], orArray = [], filterArray = []) {

    }

    async insertChecksum(algo, checksum, id) {
        return await this.hashmaps.put(`${algo}/${checksum}`, id);
    }

    async findIdByChecksum(algo, checksum) {
        return await this.hashmaps.get(`${algo}/${checksum}`);
    }

    async query(query) {}


    /**
     * Metadata document schemas
     */

    listSchemas() {
        return DOCUMENT_SCHEMAS.keys();
    }

    getSchema(name) {
        const SchemaClass = DOCUMENT_SCHEMAS.get(name);
        if (!SchemaClass) {
            throw new Error(`Schema '${name}' not found`);
        }
        return SchemaClass;
    }


    /**
     * Utils
     */

    async close() {
        await this.#db.close();
        debug('SynapsD closed');
    }

}

module.exports = SynapsD;
