import { promises as fs } from 'fs';
import path from 'path';
import Collection from './Collection.js';

class PersistentIndex {

    constructor(configRootPath) {
        this.configRootPath = configRootPath;
        this.indexes = {};
    }

    async init() {
        await this.ensureConfigDir();
    }

    async ensureConfigDir() {
        try {
            await fs.mkdir(this.configRootPath, { recursive: true });
        } catch (err) {
            console.error('Error creating config directory:', err);
        }
    }

    create(name) {
        if (this.indexes[name]) {
            console.warn(`Index '${name}' already exists.`);
            return this.indexes[name];
        }

        const filePath = path.join(this.configRootPath, `${name}.json`);
        this.indexes[name] = new Collection(filePath);
        return this.indexes[name];
    }

    get(name) {
        return this.indexes[name];
    }

    async update(name, newIndex) {
        if (!this.indexes[name]) {
            throw new Error(`Index '${name}' not found`);
        }

        this.indexes[name] = newIndex;
        await newIndex.save();
    }

    async delete(name) {
        if (!this.indexes[name]) {
            throw new Error(`Index '${name}' not found`);
        }

        const filePath = path.join(this.configRootPath, `${name}.json`);
        try {
            await fs.unlink(filePath);
            delete this.indexes[name];
        } catch (err) {
            console.error(`Error deleting index '${name}':`, err);
        }
    }
}

export default PersistentIndex;
