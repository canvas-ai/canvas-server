'use strict';

import fs from 'fs';
import util from 'util';
import path from 'path';

// TODO: Use https://www.npmjs.com/package/write-file-atomic
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const writeFileSync = fs.writeFileSync;
const readFileSync = fs.readFileSync;

class JsonMap extends Map {
    #initialized = false;

    constructor(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('File path must be a string');
        }
        super();

        this.filePath = path.extname(filePath) === '.json' ? filePath : filePath + '.json';
        this.dataRoot = path.dirname(this.filePath);
        if (!fs.existsSync(this.dataRoot)) {
            fs.mkdirSync(this.dataRoot, { recursive: true });
        }

        this.loadSync();
    }

    async set(key, value) {
        super.set(key, value);
        await this.save();
    }

    setSync(key, value) {
        super.set(key, value);
        this.saveSync();
    }

    has(key) {
        return super.has(key);
    }

    async delete(key) {
        super.delete(key);
        await this.save();
    }

    deleteSync(key) {
        super.delete(key);
        this.saveSync();
        return true;
    }

    async clear() {
        super.clear();
        await this.save();
    }

    clearSync() {
        super.clear();
        this.saveSync();
    }

    async load() {
        try {
            const data = await readFile(this.filePath, 'utf8');
            const jsonData = JSON.parse(data);
            for (const [key, value] of jsonData) {
                super.set(key, value);
            }
            this.#initialized = true;
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.info(`The file ${this.filePath} does not exist, file will be created on first update`);
            } else {
                console.error(`An error occurred while loading the file: ${err}`);
                throw new Error(err);
            }
        }
    }

    loadSync() {
        try {
            const data = readFileSync(this.filePath, 'utf8');
            if (!data) {
                return;
            }
            const jsonData = JSON.parse(data);
            for (const [key, value] of jsonData) {
                super.set(key, value);
            }
            this.#initialized = true;
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.info(`The file ${this.filePath} does not exist, file will be created on first update`);
            } else {
                console.error(`An error occurred while loading the file: ${err}`);
                throw new Error(err);
            }
        }
    }

    async save() {
        const mapAsJson = JSON.stringify([...this], null, 2);
        await writeFile(this.filePath, mapAsJson, { flag: 'w' });
    }

    saveSync() {
        const mapAsJson = JSON.stringify([...this], null, 2);
        writeFileSync(this.filePath, mapAsJson, { flag: 'w' });
    }
}

export default JsonMap;
