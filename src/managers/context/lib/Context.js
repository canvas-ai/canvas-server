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
    #tree;

    constructor(url, options = {}) {
        super();

        this.#id = options.id || uuidv4();
        this.#parsedUrl = new Url(url);
        this.#url = url;

        this.#session = options.session;
        this.#workspace = options.workspace;
        this.#device = options.device;
        this.#user = options.user;

        // If URL doesn't have a session ID but we have a session, update the parsed URL
        // We don't update the raw URL here, that will happen in initialize()
        if (!this.#parsedUrl.hasSessionId && this.#session) {
            debug(`URL doesn't have a session ID, using provided session: ${this.#session.id}`);

            if (this.#parsedUrl.hasWorkspaceId) {
                // If URL has a workspace ID, create a full URL
                this.#parsedUrl = this.#parsedUrl.withSessionId(this.#session.id);
            }
            // If URL doesn't have a workspace ID, we'll handle this in initialize()
        }

        this.#created = options.created || new Date().toISOString();
        this.#updated = options.updated || new Date().toISOString();

        debug(`Context created: ${this.#id} (${url})`);
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug(`Initializing context: ${this.#id}`);

        // If URL doesn't have a workspace ID but we have a workspace, update the URL
        if (!this.#parsedUrl.hasWorkspaceId && this.#workspace) {
            debug(`URL doesn't have a workspace ID, using current workspace: ${this.#workspace.id}`);

            // If URL also has a session ID, create a full URL
            if (this.#parsedUrl.hasSessionId && this.#session) {
                this.#parsedUrl = this.#parsedUrl.withSessionAndWorkspace(
                    this.#session.id,
                    this.#workspace.id,
                );
            } else {
                // Otherwise, create a workspace URL
                this.#parsedUrl = this.#parsedUrl.withWorkspaceId(this.#workspace.id);
            }

            // Update the raw URL
            this.#url = this.#parsedUrl.toString();
            debug(`Updated URL to: ${this.#url}`);
        }

        // Get the tree from the workspace
        if (this.#workspace) {
            this.#tree = await this.#workspace.getTree();
            debug(`Got tree from workspace: ${this.#workspace.id}`);
        }

        // Initialize layers from the path
        await this.#initializeLayers();

        this.#initialized = true;

        return this;
    }

    /**
     * Initialize layers from the path
     */
    async #initializeLayers() {
        if (!this.#workspace) {
            debug('No workspace available to initialize layers');
            return;
        }

        const path = this.#parsedUrl.path;
        debug(`Initializing layers from path: ${path}`);

        try {
            // Use the workspace to create layers from the path
            const layers = await this.#workspace.createLayersFromPath(path);

            // Add layers to the context
            if (Array.isArray(layers)) {
                for (const layer of layers) {
                    this.#layers.set(layer.name, layer);
                    debug(`Added layer from workspace: ${layer.name}`);
                }
            } else {
                debug('No layers returned from workspace.createLayersFromPath()');
            }
        } catch (err) {
            debug(`Error initializing layers from path: ${err.message}`);
            // Fallback to manual layer creation if workspace method fails
            await this.#createLayersManually();
        }
    }

    /**
     * Create layers manually from the path (fallback method)
     */
    async #createLayersManually() {
        const path = this.#parsedUrl.path;
        const pathParts = path.split('/').filter(part => part.length > 0);

        debug(`Creating layers manually from path parts: ${pathParts.join(', ')}`);

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

        // Try to get layer from workspace tree if available
        let layer = null;
        if (this.#tree) {
            try {
                layer = await this.#tree.getLayer(name);
                debug(`Got layer from tree: ${name}`);
            } catch (err) {
                debug(`Could not get layer from tree: ${err.message}`);
            }
        }

        // Create layer if not found in tree
        if (!layer) {
            layer = {
                id: options.id || uuidv4(),
                name,
                type: options.type || 'generic',
                filters: options.filters || [],
                data: options.data || {},
                created: options.created || new Date().toISOString(),
                updated: options.updated || new Date().toISOString(),
            };
            debug(`Created new layer: ${name}`);
        }

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
            updated: options.updated || new Date().toISOString(),
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
     * @returns {Promise<boolean>} - True if URL was set successfully
     */
    async setUrl(url) {
        const oldUrl = this.#url;
        const oldParsedUrl = this.#parsedUrl;

        // Parse the new URL
        this.#parsedUrl = new Url(url);

        // If URL doesn't have a workspace ID but we have a workspace, update the URL
        if (!this.#parsedUrl.hasWorkspaceId && this.#workspace) {
            debug(`URL doesn't have a workspace ID, using current workspace: ${this.#workspace.id}`);

            // If URL also has a session ID, create a full URL
            if (this.#parsedUrl.hasSessionId && this.#session) {
                this.#parsedUrl = this.#parsedUrl.withSessionAndWorkspace(
                    this.#session.id,
                    this.#workspace.id,
                );
            } else {
                // Otherwise, create a workspace URL
                this.#parsedUrl = this.#parsedUrl.withWorkspaceId(this.#workspace.id);
            }

            // Update the URL
            url = this.#parsedUrl.toString();
            debug(`Updated URL to: ${url}`);
        }

        this.#url = url;

        debug(`Setting URL from ${oldUrl} to ${url}`);

        // Check if workspace has changed
        if (this.#parsedUrl.hasWorkspaceId &&
            (oldParsedUrl.workspaceId !== this.#parsedUrl.workspaceId)) {

            debug(`Workspace ID changed from ${oldParsedUrl.workspaceId} to ${this.#parsedUrl.workspaceId}`);

            // Get the workspace manager
            const workspaceManager = global.app.getManager('workspace');
            if (!workspaceManager) {
                throw new Error('Workspace manager not available');
            }

            // Check if the new workspace exists
            const newWorkspace = await workspaceManager.getWorkspace(this.#parsedUrl.workspaceId);
            if (!newWorkspace) {
                throw new Error(`Workspace not found: ${this.#parsedUrl.workspaceId}`);
            }

            // Switch to the new workspace
            this.#workspace = newWorkspace;

            // Get the tree from the new workspace
            this.#tree = await this.#workspace.getTree();

            debug(`Switched to workspace: ${this.#workspace.id}`);

            // Emit workspace changed event
            this.emit('workspace:changed', {
                oldWorkspaceId: oldParsedUrl.workspaceId,
                newWorkspaceId: this.#parsedUrl.workspaceId,
                workspace: this.#workspace,
            });
        }

        // Check if path has changed
        if (oldParsedUrl.path !== this.#parsedUrl.path) {
            debug(`Path changed from ${oldParsedUrl.path} to ${this.#parsedUrl.path}`);

            // Clear existing layers
            this.#layers.clear();

            // Re-initialize layers from the new path
            if (this.#workspace) {
                try {
                    // Use the workspace to create layers from the new path
                    const layers = await this.#workspace.createLayersFromPath(this.#parsedUrl.path);

                    // Add layers to the context
                    if (Array.isArray(layers)) {
                        for (const layer of layers) {
                            this.#layers.set(layer.name, layer);
                            debug(`Added layer from workspace: ${layer.name}`);
                        }
                    }
                } catch (err) {
                    debug(`Error creating layers from path: ${err.message}`);
                    // Fallback to manual layer creation
                    await this.#createLayersManually();
                }
            } else {
                // Fallback to manual layer creation
                await this.#createLayersManually();
            }

            // Emit path changed event
            this.emit('path:changed', {
                oldPath: oldParsedUrl.path,
                newPath: this.#parsedUrl.path,
            });
        }

        // Update context
        this.#updated = new Date().toISOString();

        this.emit('url:changed', {
            oldUrl,
            newUrl: url,
            oldParsedUrl,
            newParsedUrl: this.#parsedUrl,
        });

        return true;
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
            updated: options.updated || new Date().toISOString(),
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
    get tree() { return this.#tree; }

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
            updated: this.#updated,
        };
    }
}

export default Context;
