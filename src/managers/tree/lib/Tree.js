// Utils
import EventEmitter from 'eventemitter2';
import debugInstance from 'debug';
const debug = debugInstance('canvas:context:tree');

import TreeNode from './TreeNode.js';
import LayerIndex from '../layers/index.js';
import { v4 as uuidv4 } from 'uuid';

class Tree extends EventEmitter {

    constructor(options = {}) {
        super();

        if (!options.treeIndexStore) { throw new Error('Tree index not provided'); }
        if (!options.layerIndexStore) { throw new Error('Layer index not provided'); }

        // TODO: Refactor, load/save ops should be handled by the treeManager
        this.dbtree = options.treeIndexStore;
        this.dblayers = new LayerIndex(options.layerIndexStore);

        this.showHidden = false;

        debug('Initializing context tree');

        this.rootLayer = this.dblayers.getLayerByName('/');
        if (!this.rootLayer) {
            throw new Error('Root layer not found in the layer index');
        }

        this.root = new TreeNode(this.rootLayer.id, this.rootLayer);
        debug(`Root node created with layer ID "${this.rootLayer.id}", name "${this.rootLayer.name}" of type "${this.rootLayer.type}"`);

        if (this.load()) {
            debug('Context tree loaded from database');
        } else {
            debug('Context tree not found in database, using vanilla root node');
        }

        debug('Context tree initialized');
        debug(JSON.stringify(this.#buildJsonTree(), null, 2));

        this.emit('ready');
    }

    get paths() { return this.#buildPathArray(); }
    get layers() { return this.dblayers; }

    pathExists(path) {
        return this.getNode(path) ? true : false;
    }

    insert(path = '/', node, autoCreateLayers = true) {
        debug(`Inserting path "${path}" to the context tree`);
        if (path === '/' && !node) { return []; }

        let currentNode = this.root;
        let child;
        const layerIds = [];

        const layerNames = path.split('/').filter(Boolean);
        for (const layerName of layerNames) {
            let layer = this.dblayers.getLayerByName(layerName);
            if (this.dblayers.isInternalLayerName(layerName)) {
                throw new Error(`Layer "${layerName}" is internal and can not be used in the tree`);
            }

            if (!layer) {
                if (autoCreateLayers) {
                    layer = this.dblayers.createLayer(layerName);
                } else {
                    debug(`Layer "${layerName}" not found at path "${path} and autoCreateLayers is disabled"`);
                    return [];
                }
            }

            layerIds.push(layer.id);

            child = currentNode.getChild(layer.id);
            if (!child) {
                child = new TreeNode(layer.id, this.dblayers.getLayerByID(layer.id));
                currentNode.addChild(child);
            }

            currentNode = child;
        }

        if (node) {
            child = currentNode.getChild(node.id);
            if (child && (child instanceof TreeNode)) {
                currentNode.addChild(child);
            }
        }

        this.save();
        debug(`Path "${path}" inserted successfully.`);
        return layerIds;
    }

    move(pathFrom, pathTo, recursive = false) {
        if (recursive) {return this.moveRecursive(pathFrom, pathTo);}
        debug(`Moving layer from "${pathFrom}" to "${pathTo}"`);

        const node = this.getNode(pathFrom);
        if (!node) {
            debug('Unable to move layer, source node not found');
            return false;
        }

        const parentPath = pathFrom.split('/').slice(0, -1).join('/');
        const parentNode = this.getNode(parentPath);
        if (!parentNode) { return false; }

        const layer = node.payload;
        const targetNode = new TreeNode(layer.id, layer);

        if (!this.insert(pathTo, targetNode)) {
            console.log(`Unable to move layer "${layer.name}" to path "${pathTo}"`);
            return false;
        }

        parentNode.removeChild(node.id);

        if (node.hasChildren) {
            for (const [key, value] of node.children.values()) {
                parentNode.addChild(value);
            }
        }

        this.save();
    }

    moveRecursive(pathFrom, pathTo) {
        debug(`Moving layer from "${pathFrom}" to "${pathTo}" recursively`);
        const node = this.getNode(pathFrom);
        const parentPath = pathFrom.split('/').slice(0, -1).join('/');
        const parentNode = this.getNode(parentPath);
        const layer = node.payload;

        if (pathTo.includes(layer.name)) {
            throw new Error(`Destination path "${pathTo}" includes "${layer.name}"`);
        }

        if (!this.insert(pathTo, node)) {
            console.log(`Unable to move layer "${layer.name}" into path "${pathTo}"`);
            return false;
        }

        parentNode.removeChild(node.id);

        this.save();
    }

    copy(pathFrom, pathTo, recursive) {
        this.save();
    }

    copyRecursive(pathFrom, pathTo) {
        this.save();
    }

    remove(path, recursive = false) {
        const node = this.getNode(path);
        if (!node) {
            debug(`Unable to remove layer, source node not found at path "${path}"`);
            return false;
        }

        const parentPath = path.split('/').slice(0, -1).join('/');
        const parentNode = this.getNode(parentPath);
        if (!parentNode) {throw new Error(`Unable to remove layer, parent node not found at path "${parentPath}"`);}

        if (!recursive && node.hasChildren) {
            for (const [key, value] of node.children.values()) {
                parentNode.addChild(value);
            }
        }

        parentNode.removeChild(node.id);

        this.save();
        return true;
    }

    renameLayer(name, newName) {
        return this.dblayers.renameLayer(name, newName);
    }

    pathToIdArray(path) {
        const layerNames = path.split('/').filter(Boolean);
        const idArray = [];
        for (const layerName of layerNames) {
            const layer = this.dblayers.getLayerByName(layerName);
            if (!layer) {
                throw new Error(`Layer "${layerName}" not found in the layer index`);
            }

            idArray.push(layer.id);
        }
        return idArray;
    }

    save() {
        debug('Saving in-memory tree to database');
        const data = this.#buildJsonIndexTree();
        try {
            this.dbtree.set('tree', data);
            debug('Tree saved successfully.');
        } catch (error) {
            debug(`Error saving tree to database: ${error.message}`);
            throw error;
        }
    }

    load() {
        debug('Loading JSON Tree from database...');
        const json = this.dbtree.get('tree');
        if (!json) {
            debug('No persistent JSON data found');
            return false;
        }

        this.root = this.#buildTreeFromJson(json);
        return true;
    }

    fromJSON(json) { return this.load(json); }
    toJSON() { return this.#buildJsonTree(); }
    getJsonIndexTree() { return this.#buildJsonIndexTree(); }
    getJsonTree() { return this.#buildJsonTree(); }
    loadJsonTree(json) { return this.#buildTreeFromJson(json); }
    clear() {
        debug('Clearing context tree');
        this.root = new TreeNode(this.rootLayer.id, this.rootLayer);
        this.save();
    }

    getNode(path) {
        if (path === '/' || !path) {return this.root;}
        const layerNames = path.split('/').filter(Boolean);
        let currentNode = this.root;

        for (const layerName of layerNames) {
            const layer = this.dblayers.getLayerByName(layerName);
            if (!layer) {
                debug(`Layer "${layerName}" not found in index`);
                return false;
            }

            const child = currentNode.getChild(layer.id);
            if (!child) {
                debug(`Target path "${path}" does not exist`);
                return false;
            }

            currentNode = child;
        }

        return currentNode;
    }

    insertNode(path, node) {
        const targetNode = this.getNode(path);
        if (!targetNode) {
            debug(`Unable to insert node at path "${path}", target node not found`);
            return false;
        }

        if (!node || !(node instanceof TreeNode)) {
            debug('Unable to move layer, source node not found');
            return false;
        }

        if (!targetNode.hasChild(node.id)) {
            targetNode.addChild(node);
        }

        this.save();
        return true;
    }

    removeNode(path, recursive = false) {
        const node = this.getNode(path);
        if (!node) {
            debug(`Unable to remove layer, source node not found at path "${path}"`);
            return false;
        }

        const parentPath = path.split('/').slice(0, -1).join('/');
        const parentNode = this.getNode(parentPath);
        if (!parentNode) {throw new Error(`Unable to remove layer, parent node not found at path "${parentPath}"`);}

        if (!recursive && node.hasChildren) {
            for (const [key, value] of node.children.values()) {
                parentNode.addChild(value);
            }
        }

        parentNode.removeChild(node.id);

        this.save();
        return true;
    }

    moveNode(pathFrom, pathTo, recursive = false) { }

    moveNodeRecursive(pathFrom, pathTo) { }

    #buildTreeFromJson(rootNode = this.root, autoCreateLayers = true) {
        const buildTree = (nodeData) => {
            let node;
            let layer;

            layer = this.dblayers.getLayerByID(nodeData.id);
            if ((!layer && !nodeData.name) || (!layer && !autoCreateLayers)) {
                throw new Error(`Unable to find layer by ID "${nodeData.id}", can not create a tree node`);
            }

            if (!layer && autoCreateLayers) {
                console.log('Not here');
                layer = this.dblayers.createLayer(nodeData.name);
            }

            node = new TreeNode(layer.id, this.dblayers.getLayerByID(layer.id));
            for (const childData of nodeData.children) {
                const childNode = buildTree(childData);
                node.addChild(childNode);
            }

            return node;
        };

        return buildTree(rootNode);
    }

    #buildJsonIndexTree(node = this.root) {
        const buildTree = (currentNode) => {
            const children = Array.from(currentNode.children.values())
                .filter(child => child instanceof TreeNode)
                .map(child => child.hasChildren ? buildTree(child) : {
                    id: child.id,
                    children: [],
                });

            return {
                id: currentNode.id,
                children: children,
            };
        };

        return buildTree(node);
    }

    #buildJsonTree(node = this.root) {
        const buildTree = (currentNode) => {
            const children = Array.from(currentNode.children.values())
                .filter(child => child instanceof TreeNode)
                .map(child => child.hasChildren ? buildTree(child) : createLayerInfo(child.payload));

            return createLayerInfo(this.dblayers.getLayerByID(currentNode.id) || this.rootLayer, children);
        };

        const createLayerInfo = (payload, children = []) => ({
            id: payload.id,
            type: payload.type,
            name: payload.name,
            label: payload.label,
            description: payload.description,
            color: payload.color,
            locked: payload.locked,
            children,
        });

        return buildTree(node);
    }

    #buildPathArray(sort = true) {
        const paths = [];
        const traverseTree = (node, parentPath) => {
            const path = (!parentPath || parentPath === '') ? '/' : `${parentPath}/${node.name}`;
            if (node.children.size > 0) {
                for (const child of node.children.values()) {
                    traverseTree(child, path);
                }
            } else {
                paths.push(path.replace(/\/\//g, '/'));
            }
        };
        traverseTree(this.root);
        return sort ? paths.sort() : paths;
    }

    /**
     * Create a new layer with the given properties
     * @param {Object} options - Layer properties
     * @returns {Object} - Created layer
     */
    createLayer(options = {}) {
        debug(`Creating layer with options: ${JSON.stringify(options)}`);

        // Generate a UUID if not provided
        if (!options.id) {
            options.id = uuidv4();
        }

        // Set default type if not provided
        if (!options.type) {
            options.type = 'generic';
        }

        // Create the layer in the layer index
        const layer = this.dblayers.createLayer(options);

        if (!layer) {
            throw new Error(`Failed to create layer with options: ${JSON.stringify(options)}`);
        }

        debug(`Layer created: ${layer.name} (${layer.id})`);
        return layer;
    }

    /**
     * Get a layer by name
     * @param {string} name - Layer name
     * @returns {Object} - Layer object or null if not found
     */
    getLayer(name) {
        return this.dblayers.getLayerByName(name);
    }

    /**
     * Get a layer by ID
     * @param {string} id - Layer ID
     * @returns {Object} - Layer object or null if not found
     */
    getLayerById(id) {
        return this.dblayers.getLayerByID(id);
    }
}

export default Tree;
