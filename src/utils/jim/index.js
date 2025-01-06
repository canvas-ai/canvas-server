import Conf from 'conf';
import lokiDriver from './driver/lokijs/index.js';
import debugInstance from 'debug';
const debug = debugInstance('canvas:service:jim');

/**
 * For now, the only supported driver is Conf
 */

class JsonIndexManager {

    constructor(options = {
        rootPath: null,
        driver: 'conf',
    }) {
        if (!options.rootPath) { throw new Error('rootPath is required'); }

        this.rootPath = options.rootPath;
        this.driver = options.driver;
        debug('Initializing JsonIndexManager service with rootPath: ', this.rootPath);
        debug('Default driver: ', this.driver);
        this.indices = new Map();
    }

    createIndex(name, driver = this.driver) {
        const id = `${name}/${driver}`;
        if (this.indices.has(id)) {
            console.warn(`Index '${name}' already exists for driver ${driver}`);
            return this.get(name, driver);
        }

        if (driver !== 'conf') {
            throw new Error(`Unsupported driver: ${driver}`);
        }

        const index = new Conf({
            configName: name,
            cwd: this.rootPath,
        });

        this.indices.set(id, index);
        return index;
    }

    getIndex(name, driver = this.driver) {
        const id = `${name}/${driver}`;

        if (!this.indices.has(id)) {
            throw new Error(`Index '${name}' for driver ${driver} not found`);
        }

        return this.indices.get(id);
    }

    listIndexes() { return Array.from(this.indices.keys()); }

}

export default JsonIndexManager;
