'use strict';

import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('context');

import Url from './Url.js';

/**
 * Context
 *
 * Represents a view on top of data, holding references to workspace, session, device, etc.
 */
class Context extends EventEmitter {
    #id;
    #url;
    #parsedUrl;
    #session;
    #workspace;
    #device;
    #user;
    #filters = new Map();
    #layers = new Map();
    #data = new Map();
    #canvases = new Map();
    #created;
    #updated;
    #initialized = false;

    constructor(url, options = {}) {
        super();

        this.#id = options.id || uuidv4();
        this.#parsedUrl = new Url(url);
        this.#url = url;

        this.#session = options.session;
        this.#workspace = options.workspace;
        this.#device = options.device;
        this.#user = options.user;

        this.#created = options.created || new Date().toISOString();
        this.#updated = options.updated || new Date().toISOString();

        debug(`Context created: ${this.#id} (${url})`);
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug(`Initializing context: ${this.#id}`);

        // Initialize layers from the path
        await this.#initializeLayers();

        this.#initialized = true;

        return this;
    }

    /**
     * Initialize layers from the path
     */
    async #initializeLayers() {
        const path = this.#parsedUrl.path;
        const pathParts = path.split('/').filter(part => part.length > 0);

        // Add each path part as a layer
        for (const part of pathParts) {
            await this.addLayer(part);
        }
    }

    /**
     * Add a layer to the context
     * @param {string} name - Layer name
     * @param {Object} options - Layer options
     * @returns {Promise<Object>} - Added layer
     */
    async addLayer(name, options = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('Layer name must be a string');
        }

        // Check if layer already exists
        if (this.#layers.has(name)) {
            return this.#layers.get(name);
        }

        // Create layer
        const layer = {
            id: options.id || uuidv4(),
            name,
            type: options.type || 'generic',
            filters: options.filters || [],
            data: options.data || {},
            created: options.created || new Date().toISOString(),
            updated: options.updated || new Date().toISOString()
        };

        // Add layer to context
        this.#layers.set(name, layer);

        // Update context
        this.#updated = new Date().toISOString();

        this.emit('layer:added', layer);

        return layer;
    }

    /**
     * Remove a layer from the context
     * @param {string} name - Layer name
     * @returns {boolean} - True if layer was removed
     */
    removeLayer(name) {
        const result = this.#layers.delete(name);

        if (result) {
            // Update context
            this.#updated = new Date().toISOString();

            this.emit('layer:removed', name);
        }

        return result;
    }

    /**
     * Get a layer by name
     * @param {string} name - Layer name
     * @returns {Object} - Layer object
     */
    getLayer(name) {
        return this.#layers.get(name);
    }

    /**
     * List all layers
     * @returns {Array<Object>} - Array of layer objects
     */
    listLayers() {
        return Array.from(this.#layers.values());
    }

    /**
     * Add a filter to the context
     * @param {string} name - Filter name
     * @param {Object} options - Filter options
     * @returns {Object} - Added filter
     */
    addFilter(name, options = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('Filter name must be a string');
        }

        // Create filter
        const filter = {
            id: options.id || uuidv4(),
            name,
            type: options.type || 'generic',
            value: options.value,
            created: options.created || new Date().toISOString(),
            updated: options.updated || new Date().toISOString()
        };

        // Add filter to context
        this.#filters.set(name, filter);

        // Update context
        this.#updated = new Date().toISOString();

        this.emit('filter:added', filter);

        return filter;
    }

    /**
     * Remove a filter from the context
     * @param {string} name - Filter name
     * @returns {boolean} - True if filter was removed
     */
    removeFilter(name) {
        const result = this.#filters.delete(name);

        if (result) {
            // Update context
            this.#updated = new Date().toISOString();

            this.emit('filter:removed', name);
        }

        return result;
    }

    /**
     * Get a filter by name
     * @param {string} name - Filter name
     * @returns {Object} - Filter object
     */
    getFilter(name) {
        return this.#filters.get(name);
    }

    /**
     * List all filters
     * @returns {Array<Object>} - Array of filter objects
     */
    listFilters() {
        return Array.from(this.#filters.values());
    }

    /**
     * Set the URL
     * @param {string} url - New URL
     */
    setUrl(url) {
        this.#parsedUrl = new Url(url);
        this.#url = url;

        // Update context
        this.#updated = new Date().toISOString();

        this.emit('url:changed', url);
    }

    /**
     * Create a canvas
     * @param {string} name - Canvas name
     * @param {Object} options - Canvas options
     * @returns {Object} - Created canvas
     */
    createCanvas(name, options = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('Canvas name must be a string');
        }

        // Check if canvas already exists
        if (this.#canvases.has(name)) {
            throw new Error(`Canvas with name "${name}" already exists`);
        }

        // Create canvas
        const canvas = {
            id: options.id || uuidv4(),
            name,
            type: options.type || 'generic',
            elements: options.elements || [],
            data: options.data || {},
            created: options.created || new Date().toISOString(),
            updated: options.updated || new Date().toISOString()
        };

        // Add canvas to context
        this.#canvases.set(name, canvas);

        // Update context
        this.#updated = new Date().toISOString();

        this.emit('canvas:created', canvas);

        return canvas;
    }

    /**
     * Get a canvas by name
     * @param {string} name - Canvas name
     * @returns {Object} - Canvas object
     */
    getCanvas(name) {
        return this.#canvases.get(name);
    }

    /**
     * List all canvases
     * @returns {Array<Object>} - Array of canvas objects
     */
    listCanvases() {
        return Array.from(this.#canvases.values());
    }

    /**
     * Remove a canvas
     * @param {string} name - Canvas name
     * @returns {boolean} - True if canvas was removed
     */
    removeCanvas(name) {
        const result = this.#canvases.delete(name);

        if (result) {
            // Update context
            this.#updated = new Date().toISOString();

            this.emit('canvas:removed', name);
        }

        return result;
    }

    /**
     * Destroy the context
     * @returns {Promise<boolean>} - True if context was destroyed
     */
    async destroy() {
        debug(`Destroying context: ${this.#id}`);

        // Clear all maps
        this.#filters.clear();
        this.#layers.clear();
        this.#data.clear();
        this.#canvases.clear();

        this.emit('destroyed', this.#id);

        return true;
    }

    // Getters
    get id() { return this.#id; }
    get url() { return this.#url; }
    get parsedUrl() { return this.#parsedUrl; }
    get session() { return this.#session; }
    get workspace() { return this.#workspace; }
    get device() { return this.#device; }
    get user() { return this.#user; }
    get created() { return this.#created; }
    get updated() { return this.#updated; }

    toJSON() {
        return {
            id: this.#id,
            url: this.#url,
            sessionId: this.#session?.id,
            workspaceId: this.#workspace?.id,
            deviceId: this.#device?.id,
            userId: this.#user?.id,
            layers: Array.from(this.#layers.values()),
            filters: Array.from(this.#filters.values()),
            canvases: Array.from(this.#canvases.values()),
            created: this.#created,
            updated: this.#updated
        };
    }
}

export default Context;
