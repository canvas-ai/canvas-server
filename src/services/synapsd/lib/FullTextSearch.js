const { Index, Document } = require("flexsearch");
const fs = require('fs').promises;
const debug = require('debug')('canvas:synapsd:fts');

class Fts {

    #store;
    #options;

    constructor(backingStore, indexOptions = {
        preset: 'performance',
        tokenize: 'forward',
        cache: true,
    }) {
        if (!backingStore) { throw new Error('backingStore is required'); }
        this.#store = backingStore;
        this.#options = indexOptions;
        // https://github.com/nextapps-de/flexsearch
        this.index = Index(this.#options);
        this.loadIndex();
    }

    /**
     * Document methods (to decide whether to keep them or not)
     */

    async addDocument(doc) {
        const indexFields = doc.index.fullTextIndexFields || [];
        let indexContent = '';

        for (const field of indexFields) {
            const value = this.getNestedValue(doc, field);
            if (value) {
                debug(`Adding field ${field} with value ${value}`);
                indexContent += value + ' ';
            }
        }

        await this.index.add(doc.id, indexContent.trim());
        await this.saveIndex();
    }

    async removeDocument(id) {
        await this.index.remove(id);
        await this.saveIndex();
    }

    async updateDocument(doc) {
        await this.removeDocument(doc.id);
        await this.addDocument(doc);
    }

    async searchDocuments(query, limit = 100) {
        const results = await this.search(query, limit);
        return results;
    }

    /**
     * Low level FTS index methods
     */

    async addString(id, content) {
        await this.index.addAsync(id, content);
        await this.saveIndex();
    }

    async addStringArray(id, contentArray) {
        for (const content of contentArray) {
            await this.index.addAsync(id, content);
        }
        await this.saveIndex();
    }

    async removeString(id) {
        await this.index.removeAsync(id);
        await this.saveIndex();
    }

    async removeStringArray(id, contentArray) {
        for (const content of contentArray) {
            await this.index.removeAsync(id, content);
        }
        await this.saveIndex();
    }

    async search(query, limit = 100) {
        const results = await this.index.searchAsync(query, limit);
        return results;
    }

    // TODO: Current backend does not support searching on a subset of documents
    // We can get those cheaply, so a nice task for whoever picks this up
    searchSync(query, limit = 100) {
        return this.index.search(query, limit);
    }


    /**
     * Utils
     */

    async loadIndex() {
        const data = await this.#store.get('index');
        if (!data) {
            console.log('No existing index found. Starting with an empty index.');
            return;
        }
        this.index.import(data);
    }

    async loadIndexFromFile() {
        try {
            const data = await fs.readFile(this.indexPath, 'utf8');
            const dump = JSON.parse(data);
            await this.index.import(dump);
            console.log('Index loaded successfully');
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('No existing index found. Starting with an empty index.');
            } else {
                console.error('Error loading index:', error);
            }
        }
    }

    async saveIndex() {
        const dump = this.index.export();
        await this.#store.put('index', dump);
    }

    async saveIndexToFile() {
        try {
            const dump = await this.index.export();
            await fs.writeFile(this.indexPath, JSON.stringify(dump));
            console.log('Index saved successfully');
        } catch (error) {
            console.error('Error saving index:', error);
        }
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
}

module.exports = Fts;
