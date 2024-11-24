import Conf from 'conf';
import lokiDriver from './driver/lokijs/index.js';
import debugInstance from 'debug';
const debug = debugInstance('canvas:service:jim');

/**
 * For now, the only supported driver is Conf
 */

class JsonIndexManager {

    constructor(rootPath, driver = 'conf') {
        if (!rootPath) { throw new Error('rootPath is required'); }

        this.rootPath = rootPath;
        this.driver = driver;
        debug('Initializing JsonIndexManager service with rootPath:', rootPath);
        debug('Default driver:', driver);
        this.indices = new Map();
    }

    create(name, driver = this.driver) {
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

    get(name, driver = this.driver) {
        const id = `${name}/${driver}`;

        if (!this.indices.has(id)) {
            throw new Error(`Index '${name}' for driver ${driver} not found`);
        }

        return this.indices.get(id);
    }

    list() { return Array.from(this.indices.keys()); }

}

export default JsonIndexManager;
