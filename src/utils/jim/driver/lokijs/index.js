import loki from 'lokijs'; // cspell:ignore lokijs
import path from 'path';
import { promises as fs } from 'fs';
import Collection from './Collection.js';

class PersistentIndex {
    constructor(configRootPath) {
        this.configRootPath = configRootPath;
        this.db = null;
        this.indexes = {};
    }

    async init() {
        await this.ensureConfigDir();
        await this.initDatabase();
    }

    async ensureConfigDir() {
        try {
            await fs.mkdir(this.configRootPath, { recursive: true });
        } catch (err) {
            console.error('Error creating config directory:', err);
        }
    }

    async initDatabase() {
        return new Promise((resolve) => {
            const dbPath = path.join(this.configRootPath, 'index.db');
            this.db = new loki(dbPath, {
                autoload: true, // cspell:ignore autoload
                autosave: true,
                autosaveInterval: 4000,
                autoloadCallback: () => {
                    // cspell:ignore autoload
                    resolve();
                },
            });
        });
    }

    create(name) {
        if (this.indexes[name]) {
            console.warn(`Index '${name}' already exists.`);
            return this.indexes[name];
        }

        let collection = this.db.getCollection(name);
        if (!collection) {
            collection = this.db.addCollection(name, { unique: ['key'] });
        }

        this.indexes[name] = new Collection(this.db, collection);
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

        const collection = this.db.getCollection(name);
        if (collection) {
            this.db.removeCollection(collection);
        }

        delete this.indexes[name];
    }

    // Expose native LokiJS database object
    getNativeDb() {
        return this.db;
    }
}

export default PersistentIndex;
