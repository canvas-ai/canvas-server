// Utils
import EventEmitter from 'eventemitter2';
import debugMessage from 'debug';
const debug = debugMessage('canvas:context:tree-manager');

// Includes
import Tree from './lib/Tree.js';

// TODO: Add tree versioning
// TODO: Finish this implementation (proxy the Tree class to trigger save on updates)
export default class TreeManager extends EventEmitter {

    #treeIndex;
    #layerIndex;
    #tree;

    constructor(options = {}) {
        super(); // EventEmitter

        if (!options.treeIndex ||
            typeof options.treeIndex.set !== 'function' ||
            typeof options.treeIndex.get !== 'function') {
            throw new Error('A treeIndex Store reference with a Map() like interface required');
        }
        this.#treeIndex = options.treeIndex;

        if (!options.layerIndex) {
            throw new Error('layerIndex required'); // TODO: Refactor in progress
        }
        this.#layerIndex = options.layerIndex;

        this.#tree = new Tree({
            treeIndex: this.#treeIndex,
            layerIndex: this.#layerIndex,
        })
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
