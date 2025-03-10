// Utils
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('tree-manager');
import EventEmitter from 'eventemitter2';
import Tree from './lib/Tree.js';

// TODO: Add tree versioning
// TODO: Finish this implementation (proxy the Tree class to trigger save on updates)
class TreeManager extends EventEmitter {

    #treeIndexStore;
    #layerIndexStore;
    #tree;

    constructor(options = {}) {
        super(); // EventEmitter

        this.#treeIndexStore = options.treeIndexStore;
        this.#layerIndexStore =  options.layerIndexStore;

        this.#tree = new Tree({
            treeIndexStore: this.#treeIndexStore,
            layerIndexStore: this.#layerIndexStore,
        });
    }

    createContextTree() {
        return this.#tree;
    }

    deleteContextTree() {
        throw new Error('Not implemented');
    }

    saveContextTree() {
        this.#tree.save(); // TODO: Refactor
    }

    loadContextTree() {
        this.#tree.load(); // TODO: Refactor
    }

    nextContextTreeVersion() {}

    previousContextTreeVersion() {}

    listContextTreeVersions() {}

    diffContextTree(vID1, vID2) {}

}

export default TreeManager;
