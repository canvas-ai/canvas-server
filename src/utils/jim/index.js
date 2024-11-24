import fsDriver from './driver/fs/index.js';
import lokiDriver from './driver/lokijs/index.js';
import debugInstance from 'debug';
const debug = debugInstance('canvas:service:jim');

class JsonIndexManager {

    constructor(rootPath) {
        if (!rootPath) {
            throw new Error('rootPath is required');
        }

        this.rootPath = rootPath;
        debug('Initializing JsonIndexManager service with rootPath:', rootPath);

        this.indices = new Map();
    }

    async create(name, driver = 'lokijs') {
        if (this.indices.has(name)) {
            console.error(`Index '${name}' already exists.`);
            //throw new Error(`Index '${name}' already exists`);
            return false;
        }

        let index;
        if (driver === 'fs') {
            index = new fsDriver(this.rootPath);
        } else if (driver === 'lokijs') {
            index = new lokiDriver(this.rootPath);
        } else {
            throw new Error(`Unsupported driver: ${driver}`);
        }

        await index.init();
        this.indices.set(name, index);

        return index;
    }

    get(name) {
        const indexData = this.indices.get(name);
        if (!indexData) {
            throw new Error(`Index '${name}' not found`);
        }

        return indexData.index;
    }

    async update(name, newIndex) {
        if (!this.indices.has(name)) {
            throw new Error(`Index '${name}' not found`);
        }

        this.indices.set(name, newIndex);
        await newIndex.init();
    }

    async delete(name) {
        if (!this.indices.has(name)) {
            throw new Error(`Index '${name}' not found`);
        }

        this.indices.delete(name);
    }

    list() {
        return Array.from(this.indices.keys());
    }

    // Expose native LokiJS database object
    getDb(name) {
        const indexData = this.indices.get(name);
        if (!indexData) {
            throw new Error(`Index '${name}' not found`);
        }

        if (indexData.driver !== 'lokijs') {
            throw new Error('Database object is only available when using LokiJS driver.');
        }

        return indexData.index.db;
    }
}

export default JsonIndexManager;
