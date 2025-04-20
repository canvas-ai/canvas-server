'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('manager:base');

/**
 * Base Manager Class
 *
 * Provides common functionality for all Canvas server managers:
 * - Standardized initialization with JIM dependency
 * - Consistent event handling
 * - Lifecycle management
 */
class Manager extends EventEmitter {
    // Internal state
    #initialized = false;
    #jim;
    #index;
    #indexName;

    /**
     * Constructor for the base Manager
     * @param {Object} options - Manager options
     * @param {Object} options.jim - JSON Index Manager instance
     * @param {string} options.indexName - Name of the index to use with JIM
     * @param {Object} [options.eventEmitterOptions] - Options for EventEmitter2
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.jim) {
            throw new Error('JSON Index Manager (jim) is required');
        }

        if (!options.indexName) {
            throw new Error('Index name is required');
        }

        this.#jim = options.jim;
        this.#indexName = options.indexName;
        this.#index = this.#jim.createIndex(this.#indexName);

        debug(`Base Manager initialized with index: ${this.#indexName}`);
    }

    /**
     * Getters
     */
    get jim() {
        return this.#jim;
    }
    get index() {
        return this.#index;
    }
    get indexName() {
        return this.#indexName;
    }
    get initialized() {
        return this.#initialized;
    }

    /**
     * Initialize the manager
     * Must be implemented by subclasses
     */
    async initialize() {
        if (this.#initialized) {
            debug(`Manager ${this.constructor.name} already initialized`);
            return true;
        }

        debug(`Initializing manager: ${this.constructor.name}`);
        // Subclasses should implement their initialization logic
        // and then call super.initialize() at the end

        this.#initialized = true;
        this.emit('initialized');
        return true;
    }

    /**
     * Start the manager - for managers that need startup procedures
     * Can be overridden by subclasses if needed
     */
    async start() {
        if (!this.#initialized) {
            throw new Error(`Manager ${this.constructor.name} must be initialized before starting`);
        }

        debug(`Starting manager: ${this.constructor.name}`);
        this.emit('started');
        return true;
    }

    /**
     * Stop the manager - for managers that need cleanup
     * Can be overridden by subclasses if needed
     */
    async stop() {
        debug(`Stopping manager: ${this.constructor.name}`);
        this.emit('stopped');
        return true;
    }

    /**
     * Helper method to safely access a configuration value
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key is not found
     * @returns {*} Configuration value or default
     */
    getConfig(key, defaultValue) {
        return this.#index.get(key, defaultValue);
    }

    /**
     * Helper method to safely set a configuration value
     * @param {string} key - Configuration key
     * @param {*} value - Value to set
     * @returns {boolean} Success status
     */
    setConfig(key, value) {
        try {
            this.#index.set(key, value);
            return true;
        } catch (error) {
            debug(`Error setting config ${key}: ${error.message}`);
            return false;
        }
    }

    /**
     * Set a parent manager reference on the JIM instance
     * This allows for accessing the parent manager from child instances
     * @param {Object} manager - The parent manager instance
     */
    setJimParentManager(manager) {
        if (this.#jim) {
            this.#jim.parentManager = manager;
        }
    }

    /**
     * Generate a UUID
     * @param {string} [prefix] - Prefix for the UUID
     * @param {number} [length] - Length of the UUID
     * @returns {string} UUID
     */
    generateUUID(prefix = '', length = 8) {
        return `${prefix}-${uuidv4().replace(/-/g, '').slice(0, length)}`;
    }
}

export default Manager;
