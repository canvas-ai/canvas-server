// Utils
import EventEmitter from 'eventemitter2';
import debugInstance from 'debug';
const debug = debugInstance('canvas:context-manager');

// Managers
import IndexManager from '../../Server.js';
import WorkspaceManager from './lib/WorkspaceManager.js';
import LayerManager from './lib/LayerManager.js';
import TreeManager from './lib/TreeManager.js';
import Context from './lib/Context.js';

// Module defaults
const MAX_CONTEXTS = 1024; // 2^10
const CONTEXT_AUTOCREATE_LAYERS = true;
const CONTEXT_URL_PROTO = 'universe';
const CONTEXT_URL_BASE = '/'


export default class ContextManager extends EventEmitter {

    #index;
    #db;

    #tree;
    #layers;
    #contexts;

    constructor(options = {}) {
        super(); // EventEmitter

        if (!options.indexStore ||
            typeof options.indexStore.set !== 'function' ||
            typeof options.indexStore.get !== 'function') {
            throw new Error('A Index Store reference with a Map() like interface required');
        }
        this.#index = options.indexStore;

        if (!db ||
            typeof options.db.set !== 'function' ||
            typeof options.db.get !== 'function') {
            throw new Error('A DB Store reference with a Map() like interface required');
        }
        this.#db = options.db;

        this.#tree = new
        this.#layers =

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
