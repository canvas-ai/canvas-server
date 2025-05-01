'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ulid } from 'ulid';
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
     * Helper method to safely access a configuration value, supports dot notation
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key is not found
     * @returns {*} Configuration value or default
     */
    getConfig(key, defaultValue) {
        return this.#index.get(key, defaultValue);
    }

    /**
     * Helper method to safely set a configuration value, supports dot notation
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
     * Get all configuration values
     * @returns {Object} All configuration values
     */
    getAllConfig() {
        return this.#index.store || {};
    }

    /**
     * Common Utilities
     */

    /**
     * Generate a UUID
     * @param {string} [prefix] - Prefix for the UUID
     * @param {number} [length] - Length of the UUID
     * @returns {string} UUID
     */
    generateUUID(prefix = '', length = 12, delimiter = '-') {
        const id = uuidv4().replace(/-/g, '').slice(0, length);
        return (prefix ? `${prefix}${delimiter}${id}` : id);
    }

    /**
     * Generate a ULID
     * @param {string} [prefix] - Prefix for the ULID
     * @param {number} [length] - Length of the ULID
     * @returns {string} ULID
     */
    generateId(prefix = '', length = 12, delimiter = '-') {
        const id = ulid().replace(/-/g, '').slice(0, length).toLowerCase();
        return (prefix ? `${prefix}${delimiter}${id}` : id);
    }

    /**
     * Generate an index key
     * @param {string} module - Module name
     * @param {string} key - Key name
     * @param {string} [delimiter] - Delimiter for the index key
     * @returns {string} Index key
     */
    generateIndexKey(module, key, delimiter = '/') {
        return `${module}${delimiter}${key}`;
    }


    /**
     * Ensure a directory exists
     * @param {string} path - Path to ensure exists
     */
    async ensureDirectoryExists(path) {
        if (!existsSync(path)) {
            await fs.mkdir(path, { recursive: true });
        }
    }

    /**
     * Ensure a directory exists (sync)
     * @param {string} path - Path to ensure exists
     */
    ensureDirectoryExistsSync(path) {
        if (!existsSync(path)) {
            fs.mkdirSync(path, { recursive: true });
        }
    }
}

export default Manager;
