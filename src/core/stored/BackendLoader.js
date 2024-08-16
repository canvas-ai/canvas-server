'use strict';

// Utils
const path = require('path');

// Temporary backend map(has to do for now)
// Maybe autogenerate based on the backends folder?
const SUPPORTED_BACKENDS = {
    'file': './backends/file',
    'lmdb': './backends/lmdb',
    's3': './backends/s3'
};

class BackendLoader {
    constructor() {
        this.backendMap = SUPPORTED_BACKENDS;
    }

    getBackendClass(driver) {
        const modulePath = this.backendMap[driver];
        if (!modulePath) {
            throw new Error(`Unsupported backend driver: ${driver}`);
        }
        return require(path.resolve(__dirname, modulePath));
    }

    addBackend(driver, modulePath) {
        // Only allow relative paths within the project directory
        if (modulePath.startsWith('.') && !modulePath.includes('..')) {
            this.backendMap[driver] = modulePath;
        } else {
            throw new Error('Invalid module path. Must be a relative path within the project directory.');
        }
    }

    listAvailableBackends() {
        return Object.keys(this.backendMap);
    }
}

module.exports = BackendLoader;
