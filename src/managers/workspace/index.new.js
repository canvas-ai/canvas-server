'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import randomcolor from 'randomcolor';
import path from 'path';
import * as fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import Conf from 'conf';
import { ulid } from '@/utils/common.js';

// Logging
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('workspace-manager');

// Includes
import Workspace from './lib/Workspace.js';

/**
 * Constants
 */

const WORKSPACE_TYPES = ['universe', 'workspace'];

const WORKSPACE_CONFIG_TEMPLATE = {
    id: ulid(6), // Just a placeholder, we use workspace name as ID
    name: 'workspace',
    type: 'workspace',
    label: 'Workspace',
    color: WorkspaceManager.getRandomColor(),
    description: 'Canvas Workspace',
    owner: null,
    path: null,
    locked: true,
    acl: {},
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    status: 'new',
};

const WORKSPACE_STATUS_VALUES = {
    NEW: 'new',
    INITIALIZED: 'initialized',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    DELETED: 'deleted',
};

const WORKSPACE_DIRECTORIES = {
    db: 'db',
    config: 'config',
    data: 'data',
    cache: 'cache',
    roles: 'roles',
    dotfiles: 'dotfiles',
};

/**
 * Workspace Manager
 */


/*
 * Workspace Manager
 *
 * Manages workspaces on disk and in memory
 *
 *
 * - Open/close workspaces
 * - Create/delete workspaces
 * - Get workspace by path or id
 * - Get all workspaces
 */
class WorkspaceManager extends EventEmitter {

    #rootPath;
    #workspaceIndex = new Map(); // Map of workspacePath -> Workspace

    /**
     * Constructor
     * @param {Object} options - Configuration options
     * @param {string} options.rootPath - Root path for workspaces
     */
    constructor(options = {}) {
        if (!options.rootPath) {
            throw new Error('Workspaces root path is required');
        }

        this.#rootPath = options.rootPath;
        debug(`Workspace manager initialized with root path: ${this.#rootPath}`);
    }

    /**
     * Getters
     */

    get rootPath() { return this.#rootPath; }
    get workspaces() { return Array.from(this.#workspaceIndex.values()); }
    get activeWorkspaces() { return this.listWorkspaces('active'); }
    get inactiveWorkspaces() { return this.listWorkspaces('inactive'); }

    /**
     * Simplified Workspace Manager API
     */

    openWorkspace(pathOrID) {
        if (!pathOrID) {
            throw new Error('Workspace path or id is required');
        }

        if (typeof pathOrID === 'string' && (pathOrID.includes('/') || pathOrID.includes('\\'))) {
            // Workspace path
            return this.#openWorkspaceByPath(pathOrID);
        }

        // Workspace id
        return this.#openWorkspaceByID(pathOrID);
    }

    closeWorkspace(workspaceID) {

    }

    /**
     * Create a new workspace
     * @param {string} workspacePath - Workspace path
     * @param {Object} options - Configuration options
     * @returns {Promise<Workspace>} Active Workspace instance
     */
    async createWorkspace(pathOrID, options = {}) {
        // Ensure the workspace path is valid
        if (!pathOrID) {
            throw new Error('Workspace path or id is required');
        }

        if (typeof pathOrID === 'string' && (pathOrID.includes('/') || pathOrID.includes('\\'))) {
            // Workspace path
            workspacePath = pathOrID;
        } else {
            // Workspace id
            workspacePath = this.#workspaceIDToPath(pathOrID);
        }

        // Check if the workspace path is already registered
        if (this.#workspaceIndex.has(workspacePath)) {
            throw new Error('Workspace path already registered');
        }

        // Validate workspace options
        if (!this.#validateWorkspaceOptions(options)) {
            throw new Error('Invalid workspace options: ' + JSON.stringify(options));
        }

        // Parse workspace options
        let parsedOptions = {};
        parsedOptions = this.#parseWorkspaceOptions(options);

        // Ensure the workspace path exists
        await this.#ensureDirectoryExists(workspacePath);
        parsedOptions.path = workspacePath;

        // Create the workspace config file
        parsedOptions.configStore = new Conf({
            configName: 'workspace',    // Will create workspace.json
            cwd: workspacePath,
            defaults: parsedOptions,
        });

        // Create the workspace instance
        const workspace = new Workspace(parsedOptions);

        // Add the workspace to the workspace index
        this.#workspaceIndex.set(workspacePath, workspace);

        // Start the workspace
        await workspace.start();

        // Return the initialized && started workspace instance
        return workspace;
    }

    /**
     * Import a workspace from a zip file or directory
     * @param {string} workspacePath - Workspace path (zip file or directory)
     * @returns {Promise<Workspace>} Inactive Workspace instance
     */
    async importWorkspace(workspacePath) {
        if (!workspacePath) {
            throw new Error('Workspace path is required');
        }

        if (this.#workspaceIndex.has(workspacePath)) {
            throw new Error('Workspace path already registered');
        }

        // Check if the workspace path is a zip file
        if (workspacePath.endsWith('.zip')) {
            // Unzip the workspace
            const zip = new AdmZip(workspacePath);
            const extractedPath = this.#rootPath;
            zip.extractAllTo(path.dirname(extractedPath), true);
            workspacePath = extractedPath;
        }

        // Try to find + load the workspace config
        const workspaceConfig = await this.#findWorkspaceConfig(workspacePath);
        if (!workspaceConfig) {
            throw new Error(`No valid workspace config found at path: ${workspacePath}`);
        }

        // Create the workspace instance
        const workspace = await this.openWorkspace(workspacePath);

        // Return the workspace instance
        return workspace;
    }

    /**
     * Export a workspace as a zip file
     * @param {string} id - Source workspace id
     * @param {string} dstPath - Destination path
     * @returns {Promise<void>}
     */
    async exportWorkspace(id, dstPath) {
        if (!id) {
            throw new Error('Workspace id is required');
        }

        if (!dstPath) {
            throw new Error('Destination path is required');
        }

        const workspacePath = this.#workspaceIDToPath(id);
        if (!this.#workspaceIndex.has(workspacePath)) {
            throw new Error('Workspace path not found');
        }

        const workspace = this.#workspaceIndex.get(workspacePath);
        if (workspace.status === WORKSPACE_STATUS_VALUES.ACTIVE) {
            throw new Error('Workspace is active, please stop it before exporting');
        }

        if (!dstPath.endsWith('.zip')) {
            dstPath = path.join(dstPath, `${workspace.name}.zip`);
        }

        // Create a zip file of the workspace
        const zip = new AdmZip();
        zip.addLocalFolder(workspacePath);
        zip.writeZip(dstPath);

        // Return the path to the zip file
        return dstPath;
    }

    async startWorkspace(workspaceID) {

    }

    async stopWorkspace(workspaceID) {

    }

    /**
     * Remove a workspace from the workspace index
     * @param {string} workspaceID - Workspace ID/name
     */
    async removeWorkspace(workspaceID) {

    }

    /**
     * Destroy a workspace (remove it from disk with all associated data)
     * @param {string} workspaceID - Workspace ID/name
     * @param {boolean} forceDestroy - Force destroy the workspace (default: false)
     */
    async destroyWorkspace(workspaceID, forceDestroy = false) {

    }

    /**
     * Helper methods
     */

    listWorkspaces(status) {
        if (!status) {
            return Array.from(this.#workspaceIndex.values());
        }

        if (!Object.values(WORKSPACE_STATUS_VALUES).includes(status)) {
            throw new Error('Invalid status: ' + status);
        }

        return Array.from(this.#workspaceIndex.values()).filter(workspace => workspace.status === status);
    }

    /**
     * Workspace Utils
     */

    /**
     * Get a random color for workspace
     * @returns {string} Random color
     * @static
     */
    static getRandomColor() {
        return randomcolor({
            luminosity: 'light',
            format: 'hex',
        });
    }

    /**
     * Validate workspace color
     * @param {string} color - Color to validate
     * @returns {boolean} True if color is a valid hex color, false otherwise
     * @static
     */
    static validateWorkspaceColor(color) {
        if (typeof color !== 'string') {
            debug('Workspace color must be a string');
            return false;
        }

        // Validate color format
        if (!color.match(/^#([0-9a-fA-F]{6})$/)) {
            debug('Workspace color must be a valid hex color');
            return false;
        }

        return true;
    }

    /**
     * Private methods
     */

    #workspacePathToID(workspacePath) {
        return path.basename(workspacePath);
    }

    #workspaceIDToPath(workspaceID) {
        return path.join(this.#rootPath, workspaceID);
    }

    async #openWorkspaceByPath(workspacePath) {
    }

    async #openWorkspaceByID(workspaceID) {}

    /**
     * Check if a path is a valid workspace
     * @param {string} workspacePath - Path to check
     * @returns {Promise<boolean>} True if path is a valid workspace
     * @private
     */
    async #findWorkspaceConfig(workspacePath) {

        // First we check if a workspace.json exists and load it
        // Valid paths are:
        // - workspacePath/config/workspace.json
        // - workspacePath/workspace.json
        // - workspacePath/.workspace.json

        let workspaceConfig = null;
        let configPath = null;

        for (const filePath of [
            path.join(workspacePath, 'config', 'workspace.json'),
            path.join(workspacePath, 'workspace.json'),
            path.join(workspacePath, '.workspace.json'),
        ]) {
            debug(`Checking for a workspace.json config file at: ${filePath}`);
            if (existsSync(filePath)) {
                try {
                    const content = await fsPromises.readFile(filePath, 'utf8');
                    workspaceConfig = JSON.parse(content);
                    configPath = filePath;
                    debug(`Found workspace.json config file at: ${filePath}`);
                    break;
                } catch (err) {
                    debug(`Failed to read/parse workspace config at ${filePath}: ${err.message}`);
                    continue;
                }
            } else {
                debug(`No workspace.json config file found at: ${filePath}`);
            }
        }

        if (!workspaceConfig) {
            debug(`No valid workspace.json config file found at: ${workspacePath}, path is not a valid workspace`);
            return false;
        }

        if (!this.#validateWorkspaceOptions(workspaceConfig)) {
            debug(`Workspace config file at: ${configPath} is not valid, path is not a valid workspace configuration file`);
            return false;
        }

        return workspaceConfig;
    }

    /**
     * Validate workspace options
     * @param {Object} options - Workspace options
     * @returns {boolean} True if options are valid, false otherwise
     * @private
     */
    #validateWorkspaceOptions(options) {
        if (!options.name) {
            debug('Workspace name is required');
            return false;
        }

        if (typeof options.name !== 'string') {
            debug('Workspace name must be a string');
            return false;
        }

        // Remove special characters except dot from workspace name
        options.name = options.name.replace(/[^a-zA-Z0-9.]/g, '');

        // Make sure Workspace name is lowercase
        options.name = options.name.toLowerCase();

        // Remove special characters except dot from workspace label if set
        if (options.label) {
            options.label = options.label.replace(/[^a-zA-Z0-9.]/g, '');
        } else {
            options.label = options.name;
        }

        if (!options.owner) {
            debug('Workspace owner is required');
            return false;
        }

        if (typeof options.owner !== 'string') {
            debug('Workspace owner must be a string');
            return false;
        }

        if (options.color && !this.validateWorkspaceColor(options.color)) {
            debug('Workspace color must be a valid hex color');
            return false;
        }

        if (options.type && !WORKSPACE_TYPES.includes(options.type)) {
            debug('Workspace type must be one of: ' + WORKSPACE_TYPES.join(', '));
            return false;
        }

        return true;
    }

    /**
     * Parse workspace options
     * @param {Object} options - Workspace options
     * @returns {Object} Parsed workspace options
     * @private
     */
    #parseWorkspaceOptions(options) {
        let parsedOptions = {
            ...WORKSPACE_CONFIG_TEMPLATE, // Question is should we keep using a pre-filled template or just use the options passed in?
            ...options,
        };

        if (!options.color) {
            parsedOptions.color = this.getRandomColor();
        }

        return parsedOptions;
    }

    /**
     * Ensure a directory existsq
     * @param {string} dirPath - Directory path
     * @returns {Promise<void>}
     * @private
     */
    async #ensureDirectoryExists(dirPath) {
        try {
            await fsPromises.mkdir(dirPath, { recursive: true });
        } catch (err) {
            throw new Error(`Failed to create directory ${dirPath}: ${err.message}`);
        }
    }

    async #scanWorkspaceDirectory(recursive = true) {

    }
}

export default WorkspaceManager;
export {
    WORKSPACE_STATUS_VALUES,
    WORKSPACE_DIRECTORIES
};
