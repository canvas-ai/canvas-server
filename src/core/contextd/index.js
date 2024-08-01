// Utils
const EventEmitter = require('eventemitter2');
const { log } = require('console'); // TODO: Replace with logger

// App includes
const Context = require('./lib/Context');
const Tree = require('./lib/Tree');

// Module defaults // TODO: Cetralize these
const MAX_CONTEXTS = 1024; // 2^10
const CONTEXT_AUTOCREATE_LAYERS = true;
const CONTEXT_URL_PROTO = 'universe';
const CONTEXT_URL_BASE = '/';
const CONTEXT_URL_BASE_ID = 'universe';

class ContextManager extends EventEmitter {

    #db;
    #tree;
    #layers;
    //#baseUrl; // Might be useful for future use cases

    constructor(options = {}) {
        super();
        this.#db = options.db;
        this.#tree = new Tree();
        this.#layers = this.#tree.layers;
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
            // TODO: To eval
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

}

module.exports = ContextManager;
