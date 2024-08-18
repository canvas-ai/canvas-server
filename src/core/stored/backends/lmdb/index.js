// Utils
const path = require('path');
const debug = require('debug')('canvas:stored:backend:lmdb');

// Includes
const StorageBackend = require('../StorageBackend');

// Module Defaults
const DEFAULT_HASH_ALGO = 'sha1';
const DEFAULT_OBJECT_EXTENSION = 'json';
const DEFAULT_OBJECT_FORMAT = 'json'; // 'json' or 'binary' (msgpack)
const DEFAULT_METADATA_EXTENSION = 'meta.json';
const DEFAULT_METADATA_FORMAT = 'json'; // 'json' or 'binary' (msgpack)
const DEFAULT_BINARY_EXTENSION = 'bin';


/**
 * Lmdb backend module
 */

class LmdbBackend extends StorageBackend {

    constructor(config) {
        debug('Initializing StoreD LMDB backend..');
        if (!config.rootPath || typeof config.rootPath !== 'string') {
            throw new Error('No or Invalid rootPath configuration');
        }

        super(config);
        this.name = 'lmdb';
        this.description = 'Canvas StoreD LMDB Backend';
        this.rootPath = config.rootPath;
        this.hashAlgorithm = config?.hashAlgorithm || DEFAULT_HASH_ALGO;
        this.metadataExtension = config?.metadataExtension || DEFAULT_METADATA_EXTENSION;
    }

}

module.exports = LmdbBackend;
