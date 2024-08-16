class StorageBackend {
    constructor(config) {
        if (new.target === StorageBackend) {
            throw new TypeError("Cannot construct StorageBackend instances directly");
        }
        this.config = config;
        // type: 'local' | 'remote'
        // driver: 's3' | 'gcs' | 'azure' | 'local.file' | 'local.memory'
        // priority: INT
        // cacheEnabled: BOOLEAN
        // name
        // description
        // config: {} // config.driverConfig
        // status

        this._status = 'uninitialized';
    }

    async putFile(key, filePath, metadata) {
        throw new Error('putAsFile method must be implemented');
    }

    async putDocument(key, data, metadata) {
        throw new Error('putAsObject method must be implemented');
    }

    async putBinary(key, data, metadata) {
        throw new Error('putAsBinary method must be implemented');
    }

    async getFile(key, options = {}) {
        throw new Error('getFile method must be implemented');
    }

    async getDocument(key, options = {}) {
        throw new Error('getDocument method must be implemented');
    }

    async getBinary(key, options = {}) {
        throw new Error('getBinary method must be implemented');
    }

    async has(key) {
        throw new Error('has method must be implemented');
    }

    async delete(key) {
        throw new Error('delete method must be implemented');
    }

    async list(options = {}) {
        throw new Error('list method must be implemented');
    }

    async stat(key) {
        throw new Error('stat method must be implemented');
    }

    getConfiguration() {
        return this.config;
    }

    get status() {
        return this._status;
    }

    set status(value) {
        this._status = value;
    }

    get supportsLocalCache() {
        return this.config.localCacheEnabled;
    }

}

module.exports = StorageBackend;
