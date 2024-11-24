import EventEmitter from 'eventemitter2';
import debugInstance from 'debug';
const debug = debugInstance('canvas:context-manager');

import LayerIndex from './index/LayerIndex.js';
import TreeIndex from './index/TreeIndex.js';

import Context from './lib/Context.js';
import Tree from './lib/Tree.js';

// Module defaults
const MAX_CONTEXTS = 1024; // 2^10
const CONTEXT_AUTOCREATE_LAYERS = true;
const CONTEXT_URL_PROTO = 'universe';
const CONTEXT_URL_BASE = '/'


class ContextManager extends EventEmitter {

    #indexManager;
    #db;
    #tree;
    #layers;
    #features;
    #filters;
    #workspaces;

    constructor(options = {}) {
        super(); // EventEmitter

        // Validate options
        if (!options.indexManager) { throw new Error('indexManager reference not provided'); }

        // Module options
        this.#indexManager = options.indexManager;

        // Indexes
        this.iTree = this.#indexManager.create('tree')
        this.iLayers = this.#indexManager.create('layers')
        this.iFeatures = this.#indexManager.create('features')
        this.iFilters = this.#indexManager.create('filters')
        this.iWorkspaces = this.#indexManager.create('workspaces')

        this.#db = options.db;
        this.layerIndex = new LayerIndex(this.iLayers);
        this.treeIndex = new TreeIndex(this.iTree);

        this.#tree = new Tree({
            layerIndex: this.iLayers,
            treeIndex: this.treeIndex,
        });

        this.#layers = this.#tree.layers; // TODO: Remove this
        this.activeContexts = new Map();



    }

    get tree() { return this.#tree; }
    get layers() { return this.#layers; }

    createContext(url, options = {}) {
        if (this.activeContexts.size >= MAX_CONTEXTS) {
            throw new Error('Maximum number of contexts reached');
        }

        let context;

        // If a context with the same id already exists, return it instead of creating a new one
        if (options.id && this.activeContexts.has(options.id)) {
            let context = this.activeContexts.get(options.id);
            // Change the url if a url is supplied
            if (url != context.url) {context.set(url);}
            return context;
        }

        // Create a new context
        context = new Context(url, this.#db, this.#tree, options);
        this.activeContexts.set(context.id, context);

        return context;
    }

    // TODO: Temporary method to return a default context
    getContext(id) {
        let context;

        if (!id) {
            // This is another ugly workaround till full session support is implemented
            context = (this.activeContexts.size > 0) ? this.activeContexts.values().next().value : this.createContext();
        } else {
            context = this.activeContexts.get(id);
            if (!context) {throw new Error(`Context with id "${id}" not found`);}
        }

        return context;
    }

    listContexts() {
        return Array.from(this.contexts.values());
    }

    removeContext(id) {
        const context = this.activeContexts.get(id);
        if (!context.destroy()) {
            log.error(`Error destroying context ${id}`); // Throw?
            return false;
        }

        this.activeContexts.delete(id);
        log.info(`Context with id ${id} closed`);
        return true;
    }

    #parseContextId(id) {
        // Remove all non-alphanumeric characters except dot, underscore and dash
        id = id.replace(/[^a-zA-Z0-9_.-]/g, '');
        if (id.length === 0) {
            throw new Error('Invalid Context ID');
        }

        return id;
    }

}

export default ContextManager;
