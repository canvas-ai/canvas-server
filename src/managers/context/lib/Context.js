// Utils
import Url from './Url.js';
import EventEmitter from 'eventemitter2';
import { uuid12 } from '@/utils/common.js';

import debugInstance from 'debug';
const debug = debugInstance('canvas:context:instance');

// Managers
import { workspaceManager } from '@/Server.js';

// Module defaults
const CONTEXT_AUTOCREATE_LAYERS = true;
const CONTEXT_URL_PROTO = 'universe';
const CONTEXT_URL_BASE = '/';
const CONTEXT_URL_BASE_ID = 'universe';

/**
 * Canvas Context
 */

class Context extends EventEmitter {

    #id;
    #session;
    #currentWorkspace;
    #currentTree;
    #url;

    #sessionId;
    #baseUrl;
    #path;
    #array;

    #layerIndex;
    #tree;
    #workspace;

    // System (server) context
    // - Location/network, runtime context
    // Client (user/app) context
    // - Sent to the server by each client(eg. client/os/linux, client/user/user1, client/app/obsidian, client/network/)
    // User context
    // - context path/tree layers

    #contextArray = []; // Implicit AND
    #featureArray = []; // Default OR
    #filterArray = [];  // Default AND

    constructor(session, options = {}) {
        if (!session) throw new Error('Session required');

        super({
            wildcard: false,
            delimiter: '/',
            newListener: false,
            removeListener: false,
            maxListeners: 100,
            verboseMemoryLeak: false,
            ignoreErrors: false
        });

        this.id = options.id || uuid12();
        this.#session = session;

        // Initialize with default universe workspace if not specified
        const initialUrl = options.url || 'universe:///';
        this.setUrl(initialUrl);
    }

    async setUrl(url) {
        debug(`Setting context url to ${url}`);

        // Parse URL format: workspaceId://path
        const [workspaceId, path] = this.#parseUrl(url);

        // Get the workspace
        const workspace = await workspaceManager.getWorkspace(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace ${workspaceId} not found`);
        }

        // Switch workspace if needed
        if (!this.#currentWorkspace || this.#currentWorkspace.id !== workspace.id) {
            this.#currentWorkspace = workspace;
            this.#currentTree = workspace.tree;
        }

        // Update the tree path
        await this.#currentTree.setContextPath(this, path);

        this.#url = url;
        this.emit('url:changed', url);
    }

    #parseUrl(url) {
        const match = url.match(/^([^:]+):\/\/(.*)$/);
        if (!match) {
            throw new Error(`Invalid context URL format: ${url}`);
        }

        const [_, workspaceId, path] = match;
        return [workspaceId, path];
    }

    get id() { return this.#id; }
    get session() { return this.#session; }
    get url() { return this.#url; }
    get currentWorkspace() { return this.#currentWorkspace; }
    get currentTree() { return this.#currentTree; }

    // Layer operations
    async addLayer(name) {
        if (!this.#currentTree) throw new Error('No active workspace');
        return await this.#currentTree.addLayer(this, name);
    }

    async removeLayer(name) {
        if (!this.#currentTree) throw new Error('No active workspace');
        return await this.#currentTree.removeLayer(this, name);
    }

    async getLayers() {
        if (!this.#currentTree) throw new Error('No active workspace');
        return await this.#currentTree.getContextLayers(this);
    }

    // Data operations
    async query(query) {
        if (!this.#currentTree) throw new Error('No active workspace');
        return await this.#currentTree.queryContext(this, query);
    }

    async insert(data) {
        if (!this.#currentTree) throw new Error('No active workspace');
        return await this.#currentTree.insertIntoContext(this, data);
    }

    async update(query, data) {
        if (!this.#currentTree) throw new Error('No active workspace');
        return await this.#currentTree.updateInContext(this, query, data);
    }

    async remove(query) {
        if (!this.#currentTree) throw new Error('No active workspace');
        return await this.#currentTree.removeFromContext(this, query);
    }

    async destroy() {
        if (this.#currentTree) {
            await this.#currentTree.removeContext(this.id);
        }
        this.emit('destroyed');
        this.removeAllListeners();
    }

    /**
	 * Getters
	 */

    get sessionId() {
        return this.#sessionId;
    }

    get baseUrl() {
        return this.#baseUrl;
    }

    get path() {
        return this.#path;
    }

    get pathArray() {
        return this.#array;
    }

    get tree() {
        return this.#tree.getJsonTree();
    }
    get paths() {
        return this.#tree.paths;
    }

    // layers
    // features
    // filters

    get bitmaps() {
        return {
            context: this.#contextArray,
            features: this.#featureArray,
            filters: this.#filterArray,
        };
    }

    get contextArray() {
        return this.#contextArray;
    }
    get featureArray() {
        return this.#featureArray;
    }
    get features() {
        return this.#featureArray;
    }
    get filterArray() {
        return this.#filterArray;
    }
    get filters() {
        return this.#filterArray;
    }

    // List all apps linked to this context
    get apps() {
        return [];
    }

    // List all identities linked to this context
    get identities() {
        return [];
    }

    /**
	 * Context management
	 */

    set(url = CONTEXT_URL_BASE, autoCreateLayers = CONTEXT_AUTOCREATE_LAYERS) {
        return this.setUrl(url, autoCreateLayers);
    }

    /**
	 * Layer management
	 */

    hasLayer(name) {
        return this.#layerIndex.hasLayerName(name);
    }

    getLayer(name) {
        return this.#layerIndex.getLayerByName(name);
    }

    createLayer(name, options) {
        return this.#layerIndex.createLayer(name, options);
    }

    updateLayer(name, options) {
        return this.#layerIndex.updateLayer(name, options);
    }

    renameLayer(name, newName) {
        return this.#layerIndex.renameLayer(name, newName);
    }

    deleteLayer(name) {
        return this.#layerIndex.removeLayerByName(name);
    }

    listLayers() {
        return this.#layerIndex.list();
    }

    /**
	 * Context tree management
	 */

    parseContextPath(path) {
        let parsed = new Url(path);
        return parsed.path;
    }

    insertContextPath(path, autoCreateLayers = CONTEXT_AUTOCREATE_LAYERS) {
        return this.#tree.insert(path, null, autoCreateLayers);
    }

    removeContextPath(path, recursive = false) {
        return this.#tree.remove(path, recursive);
    }

    moveContextPath(path, newPath, recursive) {
        return this.#tree.move(path, newPath, recursive);
    }

    copyContextPath(path, newPath, recursive) {
        return this.#tree.copy(path, newPath, recursive);
    }

    saveContextTree() {
        return this.#tree.save();
    }

    updateContextTreeFromJson(json) {
        return this.#tree.load(json);
    }

    /**
	 * neurald methods
	 */

    query(
        query,
        ctxArr = this.#contextArray,
        ftArr = this.#featureArray,
        filArr = this.#filterArray,
    ) {



    }


    /**
	 * Features
	 */

    insertFeature(feature) {}
    updateFeature(feature) {}
    removeFeature(feature) {}
    listActiveFeatures() {}
    listFeatures() {}


    /**
	 * Filters
	 */

    insertFilter(filter) {}
    updateFilter(filter) {}
    removeFilter(filter) {}
    listActiveFilters() {}
    listFilters() {}


    /**
	 * Data store methods
	 */

    async listDocuments(featureArray = this.#featureArray, filterArray = this.#filterArray) {
        if (typeof featureArray === 'string') {featureArray = [featureArray];}
        debug(`Listing documents linked to context "${this.#url}"`);
        debug(`Context array: "${this.#contextArray}"`);
        debug(`Feature array: "${featureArray}"`);
        debug(`Filter array: "${filterArray}"`);
        const result = await this.documents.listDocuments(
            this.#contextArray,
            featureArray,
            filterArray,
        );

        return result;
    }

    // TODO: Refactor the whole interface
    getDocument(id) {
        // TODO: Should also pass this.#contextArray and return null if the ID is not part of the current context!
        return this.documents.getDocument(id);
    }

    // TODO: Refactor the whole interface
    getDocumentByHash(hash) {
        // TODO: Should also pass this.#contextArray and return null if the ID is not part of the current context!
        return this.documents.getDocumentByHash(hash);
    }

    async getDocuments(featureArray = this.#featureArray, filterArray = this.#filterArray) {
        if (typeof featureArray === 'string') {featureArray = [featureArray];}
        debug(`Getting documents linked to context "${this.#url}"`);
        debug(`Context array: "${this.#contextArray}"`);
        debug(`Feature array: "${featureArray}"`);
        debug(`Filter array: "${filterArray}"`);
        const result = this.documents.getDocuments(
            this.#contextArray,
            featureArray,
            filterArray,
        );
        return result;
    }

    async insertDocument(document, featureArray = this.#featureArray, batchOperation = false /* temporary hack */) {
        if (typeof featureArray === 'string') {featureArray = [featureArray];}
        const result = await this.documents.insertDocument(
            document,
            this.#contextArray,
            featureArray,
        );
        debug(`insertDocument() result ${result}`);
        if (!batchOperation) {this.emit('data', 'insertDocument', result);}
        return result;
    }

    async insertDocumentArray(docArray, featureArray = this.#featureArray) {
        debug(`Inserting document array to context "${this.#url}"`);
        debug(`Feature array: ${featureArray}`);
        if (typeof featureArray === 'string') {featureArray = [featureArray];}
        const result = await this.documents.insertDocumentArray(
            docArray,
            this.#contextArray,
            featureArray,
            true,
        );
        debug(`insertDocumentArray() result ${result}`);
        this.emit('data', 'insertDocumentArray', result);
        return result;
    }

    async updateDocument(document, contextArray, featureArray) {
        if (typeof featureArray === 'string') {featureArray = [featureArray];}
        const result = await this.documents.updateDocument(
            document,
            this.#contextArray,
            featureArray,
        );
        this.emit('data', 'updateDocument', result);
        return result;
    }

    async updateDocumentArray(documentArray) {}

    async removeDocument(id) {
        if (this.#path === '/') {
            throw new Error(`Cannot remove document ID "${id}" from universe, use deleteDocument() instead`);
        }

        debug(`Removing document with id "${id}" from context "${this.#url}"`);
        if (typeof id !== 'string' && typeof id !== 'number') {
            throw new Error(`Document ID must be of type string or number, "${typeof id}" given`);
        }

        const result = await this.documents.removeDocument(id, this.#contextArray);
        this.emit('data', 'removeDocument', result);
        return result;
    }

    async removeDocumentArray(idArray) {
        debug(`Removing document array from context "${this.#url}"`);
        if (!Array.isArray(idArray)) {
            throw new Error(`Document ID array must be of type array, "${typeof idArray}" given`);
        }

        const result = await this.documents.removeDocumentArray(idArray, this.#contextArray);
        return result;
    }

    async deleteDocument(id) {
        debug(`Deleting document with id "${id}" from Canvas"`);
        if (typeof id !== 'string' && typeof id !== 'number') {
            throw new Error(`Document ID must be of type string or number, "${typeof id}" given`);
        }

        const result = await this.documents.deleteDocument(id);
        this.emit('data', 'deleteDocument', result);
        return result;
    }

    async deleteDocumentArray(idArray) {
        debug('Deleting document array from Canvas"');
        if (!Array.isArray(idArray)) {
            throw new Error(`Document ID array must be of type array, "${typeof idArray}" given`);
        }

        const result = await this.documents.deleteDocumentArray(idArray);
        return result;
    }

    getDocumentSchema(schema = 'default') {
        return this.documents.getDocumentSchema(schema);
    }


    /**
	 * Misc
	 */

    getEventListeners() {
        return this.eventNames();
    }

    stats() {
        return {
            id: this.#id,
            sessionId: this.#sessionId,
            baseUrl: this.#baseUrl,
            url: this.#url,
            path: this.#path,
            array: this.#array,
            contextArray: this.#contextArray,
            featureArray: this.#featureArray,
            filterArray: this.#filterArray,
        };
    }

    /**
	 * Internal methods
	 */

    #initializeTreeEventListeners() {
        this.#tree.on('update', (tree) => {
            this.emit('context:tree:update', tree);

        });

        /* this.#tree.on('insert', (tree) => {
				this.emit('context:tree:insert', tree)
			})
			this.#tree.on('remove', (tree) => {
				this.emit('context:tree:remove', tree)
			})
			this.#tree.on('update', (tree) => {
				this.emit('context:tree:update', tree)
			})*/
    }

    #initializeLayers(
        layerArray = [],
        autoCreateLayers = CONTEXT_AUTOCREATE_LAYERS,
    ) {
        let ctxArr = [];
        let ftArr = [];
        let filArr = [];

        layerArray.forEach((layerName) => {
            let layer = !this.#layerIndex.hasLayerName(layerName) && autoCreateLayers
                ? this.createLayer(layerName)
                : this.#layerIndex.getLayerByName(layerName);

            if (!layer) {
                debug(`Layer "${layerName}" not found and autoCreateLayers is set to false, skipping initialization`);
                return; // TODO: FIXME
            }

            ctxArr.push(layer.id);
            ftArr.push(...layer.featureBitmaps);
            filArr.push(...layer.filterBitmaps);
        });

        this.#initializeContextBitmaps(ctxArr);
        this.#initializeFeatureBitmaps(ftArr);
        this.#initializeFilterBitmaps(filArr);
    }

    #initializeContextBitmaps(arr) {
        // Clear local context map
        this.#contextArray.length = 0;
        arr.forEach((uuid) => {
            debug(`Adding context bitmap UUID "${uuid}" to contextArray`);
            this.#contextArray.push(uuid);
        });
    }

    #initializeFeatureBitmaps(arr) {
        // Clear local feature map
        this.#featureArray.length = 0;
        arr.forEach((uuid) => {
            debug(`Adding feature bitmap UUID "${uuid}" to context featureArray`);
            this.#featureArray.push(uuid);
        });
    }

    #initializeFilterBitmaps(arr) {
        // Clear local filter map
        this.#filterArray.length = 0;
        arr.forEach((uuid) => {
            debug(`Adding filter bitmap UUID "${uuid}" to context filterArray`);
            this.#filterArray.push(uuid);
        });
    }

    #parseContextArray(arr) {
        let parsed = arr.flatMap((element) => {
            return element.includes('/') ? element.split('/') : element;
        });

        return parsed.filter((x, i, a) => a.indexOf(x) === i);
        // return [... new Set(parsed)]
    }

    // Context operations
    async createChild(path) {
        const childPath = this.#normalizePath(path);
        const fullPath = path.join(this.path, childPath);

        return new Context(
            this.sessionId,
            this.#workspace,
            fullPath
        );
    }
}

export default Context;
