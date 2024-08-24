'use strict';

// Utils
const EE = require('eventemitter2');
const debug = require('debug')('canvas:stored');

// Data ingestion utils
const {
    isJson,
    isFile,
    isBuffer,
    isBinary,
} = require('./utils/common');
const {
    checksumJson,
    checksumBuffer,
    checksumFile,
    checksumFileArray,
} = require('./utils/checksums');

const embeddings = require('./utils/embeddings');
const fileinfo = require('./utils/fileinfo');

// StoreD caching layer
const Cache = require('./cache');


/**
 * StoreD
 *
 * GET operations will by default try local cache, then cycle through the backends in the order submitted
 * in the backend array, returning the first successful operation(optionally populating the cache).
 *
 * Insert operations will first try to store an object in a backend of type: local, honoring the backend cache
 * configuration for write operations. If no local backend is provided, we'll default to cache if enabled,
 * then send the internal cache url to a syncd queue read by a worker process synchronizing to all selected
 * backends.
 *
 * @class Stored
 * @param {Object} config - StoreD configuration object
 */

class Stored extends EE {

    constructor(config = {}) {
        debug('Initializing Canvas StoreD');
        if (!config) { throw new Error('No configuration provided'); }
        if (!config.cache) { throw new Error('No configuration object provided at options.config.cache'); }
        if (!config.backends) { throw new Error('No configuration object provided at options.config'); }

        // Initialize event emitter
        super(config.eventEmitter || {});

        // Initialize utils
        this.config = config;
        this.logger = config.logger || console; // will break, fixme
        this.utils = {
            isJson,
            isFile,
            isBuffer,
            isBinary,
            checksumJson,
            checksumBuffer,
            checksumFile,
            checksumFileArray
        };

        // Initialize global cache
        this.cache = new Cache(this.config.cache);

        // Initialize backends
        // Naming convention is not very flexible but should be enough for now
        // canvas://{instance}:{backend}/{type}/{identifier}
        // canvas://local:lmdb/checksum/sha1/hash
        // canvas://local:lmdb/id/1234
        // canvas://office:s3/file/path/to/object
        // canvas://remote:api/blob/12345
        // canvas://deviceid:fs/path/to/indexed/file
        this.backends = {};
        this.#initializeBackends();
    }


    /**
     * Main interface
     */

    /**
     * Inserts a document into the storage backend(s).
     * @param {Object} document - The document to insert.
     * @param {Object} metadata - Optional metadata associated with the document.
     * @param {string|string[]} backends - Name or array of backend names.
     * @param {Object} options - Additional options for the insertion.
     */
    async insertDocument(document, metadata = {}, backends = this.backends, options = {}) {

    }

    /**
     * Inserts a file into the storage backend(s) by file path.
     * @param {string} filePath - The file path to insert.
     * @param {Object} metadata - Optional metadata associated with the file.
     * @param {string|string[]} backends - Name or array of backend names.
     * @param {Object} options - Additional options for the insertion.
     * @returns {Promise} - Result of inserting the file as a URL.
     */
    async insertFile(filePath, metadata = {}, backends = this.backends, options = {}) {
        return this.insertUrl(filePath, metadata, backends, options);
    }

    /**
     * Inserts a URL into the storage backend(s).
     * @param {string} resourceUrl - The URL to insert.
     * @param {Object} metadata - Optional metadata associated with the URL.
     * @param {string|string[]} backends - Name or array of backend names.
     * @param {Object} options - Additional options for the insertion.
     */
    async insertUrl(resourceUrl, metadata = {}, backends = this.backends, options = {}) {
        // Implementation here
    }

    /**
     * Inserts binary data (blob) into the storage backend(s).
     * @param {Buffer|ArrayBuffer} data - The binary data to insert.
     * @param {Object} metadata - Optional metadata associated with the blob.
     * @param {string|string[]} backends - Name or array of backend names.
     * @param {Object} options - Additional options for the insertion.
     */
    async insertBlob(data, metadata = {}, backends = this.backends, options = {}) {
        // Implementation here
    }

    async getFile(hash, backends = this.backends, options = {
        // Return as a stream
        // stream: false
        // Return as a direct file path
        // filePath: false
    }) {
        if (!hash) { throw new Error('No hash provided'); }
        const backendNames = Array.isArray(backends) ? backends : [backends];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }
    }

    // Returns structured data(JSON document) parsed into an object
    async getDocument(hash, backends = this.backends, options = {
        // Return raw JSON string instead of parsed object
        // raw: false
        // Return only metadata
        // metadataOnly: false
    }) {
        if (!hash) { throw new Error('No hash provided'); }

        const backendNames = Array.isArray(backends) ? backends : [backends];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }

        // Documents are not cached for now, so no cache logic here
    }

    // Returns binary data(blob) as a Buffer
    async getBLob(hash, backends = this.backends, options = {}) {
        if (!hash) { throw new Error('No hash provided'); }

        const backendNames = Array.isArray(backends) ? backends : [backends];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }
    }

    async has(hash, backends = this.backends, options = {}) {
        if (!hash) { throw new Error('No hash provided'); }
        const backendNames = Array.isArray(backends) ? backends : [backends];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);

            if (this.config.backends[backendName].localCacheEnabled) {
                try {
                    const cacheInfo = await this.cache.has(hash);
                    if (cacheInfo) {
                        debug(`Cache hit for ${hash} in backend ${backendName}`);
                        // return true;
                    } else {
                        debug(`Cache miss for ${hash} in backend ${backendName}`);
                        // Log miss and update cache if found?
                    }
                } catch (error) {
                    debug(`Cache error for ${hash} in backend ${backendName}: ${error.message}`);
                }
            }

            try {
                const exists = await backend.has(hash);
                if (exists) { return true; }
            } catch (error) {
                debug(`Error checking object existence in backend ${backendName}: ${error.message}`);
                if (this.config.backends[backendName].ignoreBackendErrors) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        return false;
    }

    async stat(hash, backends = this.backends) {
        const backendNames = Array.isArray(backends) ? backends : [backends];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);
            try {
                return await backend.stat(hash);
            } catch (error) {
                debug(`Error getting stats for object in backend ${backendName}: ${error.message}`);
                if (!this.config.backends[backendName].ignoreBackendErrors) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        throw new Error(`Object not found: ${hash}`);
    }

    async delete(hash, backends) {
        const backendNames = Array.isArray(backends) ? backends : [backends];
        const results = [];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);
            try {
                const result = await backend.delete(hash);
                results.push({ backend: backendName, result });

                if (this.config.backends[backendName].localCacheEnabled) {
                    await this.cache.delete(hash);
                }
            } catch (error) {
                debug(`Error deleting object from backend ${backendName}: ${error.message}`);
                if (!this.config.backends[backendName].ignoreBackendErrors) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        return results;
    }


    /**
     * Backend methods
     */

    getBackend(backendName) {
        const backend = this.backends[backendName];
        if (!backend) {
            throw new Error(`Backend not found: ${backendName}`);
        }
        return backend;
    }

    listBackends() {
        return Object.keys(this.backends);
    }

    setBackendStatus(backendName, status) {
        this.getBackend(backendName).status = status;
    }

    getBackendStatus(backendName) {
        return this.getBackend(backendName).status;
    }

    getBackendConfiguration(backendName) {
        return this.getBackend(backendName).getConfiguration();
    }

    #initializeBackends() {
        for (const [name, config] of Object.entries(this.config.backends)) {
            const backend = config.backend;
            const backendConfig = config.backendConfig;
            // Load backend class
            const BackendClass = require(`./backends/${backend}`);
            this.backends[name] = new BackendClass(backendConfig);
        }
    }
}

module.exports = Stored;
