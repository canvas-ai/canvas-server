// Utils
import EventEmitter from 'eventemitter2';
import randomcolor from 'randomcolor';
import path from 'path';
import * as fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Conf from 'conf';

// Logging
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('workspace-manager');

// Includes
import Workspace from './lib/Workspace.js';

// Constants
const WORKSPACE_TYPES = [
    'universe',
    'workspace',
]

const WORKSPACE_DIRECTORIES = {
    db: 'db',
    config: 'config',
    data: 'data',
    cache: 'cache',
    dotfiles: 'dotfiles',
}

/**
 * Workspace Manager
 * Manages workspaces for a single user
 */
class WorkspaceManager extends EventEmitter {

    #rootPath;
    #workspaceIndex = new Map(); // Map of workspaceID -> Workspace
    #openWorkspaces = new Map(); // Map of workspaceID -> Workspace
    #initialized = false;

    /**
     * Create a new WorkspaceManager instance
     * @param {Object} options - Configuration options
     * @param {string} options.rootPath - Root path for user's workspaces
     */
    constructor(options = {}) {
        super(); // EventEmitter
        debug('Initializing workspace manager');

        if (!options.rootPath) {
            throw new Error('Workspace root path is required');
        }

        this.#rootPath = options.rootPath;
        debug(`Workspaces root path: ${this.#rootPath}`);
    }

    /**
     * Getters
     */

    get rootPath() { return this.#rootPath; }
    get workspaces() { return Array.from(this.#workspaceIndex.values()); }
    get openWorkspaces() { return Array.from(this.#openWorkspaces.values()); }

    /**
     * Initialize the workspace manager
     * @returns {Promise<void>}
     * @throws {Error} If initialization fails
     */
    async initialize() {
        if (this.#initialized) {
            debug('Workspace manager already initialized');
            return;
        }

        debug('Initializing workspace manager');

        // Ensure root path exists
        try {
            await this.#ensureDirectoryExists(this.#rootPath);
            debug(`Workspaces root directory ensured at ${this.#rootPath}`);
        } catch (err) {
            const error = new Error(`Failed to initialize workspace manager: ${err.message}`);
            debug(error.message);
            throw error;
        }

        // Scan for existing workspaces
        await this.#scanWorkspaces();

        this.#initialized = true;
        debug('Workspace manager initialized successfully');
    }

    /**
     * Create a new workspace
     * @param {string} workspaceID - Workspace ID/name
     * @param {Object} options - Workspace options
     * @returns {Promise<Workspace>} The created workspace
     */
    async createWorkspace(workspaceID, options = {}) {
        // Validate required parameters
        if (!workspaceID) {
            throw new Error('Workspace ID is required');
        }

        // Create the workspace directory path
        const workspacePath = options.path || path.join(this.#rootPath, workspaceID);
        debug(`Creating workspace "${workspaceID}" at ${workspacePath}`);

        try {
            // Check if workspace already exists
            if (existsSync(workspacePath)) {
                throw new Error(`Workspace directory already exists at ${workspacePath}`);
            }

            // Create workspace directory structure
            await this.#ensureDirectoryExists(workspacePath);
            for (const [key, dirName] of Object.entries(WORKSPACE_DIRECTORIES)) {
                await this.#ensureDirectoryExists(path.join(workspacePath, dirName));
                debug(`Created workspace ${key} directory: ${dirName}`);
            }

            // Create a Conf instance for workspace config
            const configStore = new Conf({
                configName: 'workspace',
                cwd: workspacePath
            });

            // Create workspace configuration
            const workspaceConfig = {
                id: options.id || workspaceID,
                name: workspaceID,
                type: options.type || 'workspace',
                label: options.label || workspaceID.charAt(0).toUpperCase() + workspaceID.slice(1),
                color: options.color || this.#getRandomColor(),
                description: options.description || `My ${workspaceID} workspace`,
                owner: options.owner || null,
                path: workspacePath,
                locked: options.locked || false,
                acl: options.acl || {},
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                status: options.status || 'initialized',
            };

            // Save workspace config
            await configStore.set(workspaceConfig);

            // Create workspace instance
            const workspace = new Workspace({
                ...workspaceConfig,
                configStore: configStore,
            });

            // Initialize workspace
            if (options.autoInitialize) {
                await this.openWorkspace(workspaceID);
            }

            // Add to tracked workspaces - use the workspaceID as the key
            this.#workspaceIndex.set(workspaceID, workspace);

            this.emit('workspace:created', workspace);
            debug(`Workspace ${workspaceID} created successfully`);

            return workspace;
        } catch (err) {
            const error = new Error(`Failed to create workspace "${workspaceID}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Load a workspace from disk
     * @param {string} workspaceID - Workspace ID/name
     * @param {string} workspacePath - Optional custom path
     * @returns {Promise<Workspace>} The loaded workspace
     */
    async loadWorkspace(workspaceID, workspacePath = null) {
        if (!workspaceID) {
            throw new Error('Workspace ID is required');
        }

        // If no path is provided, use the default path
        if (!workspacePath) {
            workspacePath = path.join(this.#rootPath, workspaceID);
        }

        debug(`Loading workspace ${workspaceID} from ${workspacePath}`);

        // Check if workspace is already loaded
        if (this.#workspaceIndex.has(workspaceID)) {
            const workspace = this.#workspaceIndex.get(workspaceID);

            // Skip if workspace is marked as deleted
            if (workspace.isDeleted) {
                debug(`Workspace ${workspaceID} is marked as deleted, skipping`);
                return null;
            }

            debug(`Workspace ${workspaceID} is already loaded`);
            return workspace;
        }

        // Check if workspace directory exists
        if (!existsSync(workspacePath)) {
            debug(`Workspace directory does not exist at ${workspacePath}`);
            return null;
        }

        try {
            // Create a Conf instance to read the workspace config
            const configStore = new Conf({
                configName: 'workspace',
                cwd: workspacePath
            });

            // Check if the config has the required fields
            if (!configStore.has('id')) {
                throw new Error(`Workspace ${workspacePath} has no id defined`);
            }

            // Get all config data
            const configData = configStore.store;

            // Skip if workspace is marked as deleted
            if (configData.status === 'deleted') {
                debug(`Workspace ${workspaceID} is marked as deleted in config, skipping`);
                return null;
            }

            // Create a workspace instance without initializing
            // Constructor will throw an error if required fields are missing
            const workspace = new Workspace({
                ...configData,
                path: workspacePath, // Path is calculated dynamically at runtime
                configStore: configStore, // Pass the config store instance
            });

            // Add to workspace index
            this.#workspaceIndex.set(workspaceID, workspace);
            debug(`Loaded workspace ${workspaceID} from ${workspacePath}`);
            this.emit('workspace:loaded', workspace);
            return workspace;
        } catch (err) {
            const error = new Error(`Failed to load workspace ${workspaceID} from "${workspacePath}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Open a workspace (initialize resources)
     * @param {string} workspaceID - Workspace ID/name
     * @returns {Promise<Workspace>} The opened workspace
     */
    async openWorkspace(workspaceID) {
        debug(`Opening workspace: ${workspaceID}`);

        // Check if workspace is already open
        if (this.#openWorkspaces.has(workspaceID)) {
            debug(`Workspace ${workspaceID} is already open`);
            return this.#openWorkspaces.get(workspaceID);
        }

        // Load the workspace if not already loaded
        let workspace;
        if (!this.#workspaceIndex.has(workspaceID)) {
            workspace = await this.loadWorkspace(workspaceID);
            if (!workspace) {
                throw new Error(`Workspace ${workspaceID} not found or is deleted`);
            }
        } else {
            workspace = this.#workspaceIndex.get(workspaceID);

            // Check if workspace is deleted
            if (workspace.isDeleted) {
                throw new Error(`Cannot open deleted workspace: ${workspaceID}`);
            }
        }

        // Initialize the workspace
        try {
            await workspace.initialize();

            // Mark workspace as active
            workspace.markAsActive();

            // Add to open workspaces
            this.#openWorkspaces.set(workspaceID, workspace);

            this.emit('workspace:opened', workspace);
            debug(`Workspace ${workspaceID} opened successfully`);

            return workspace;
        } catch (err) {
            const error = new Error(`Failed to open workspace "${workspaceID}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Close a workspace (shutdown resources)
     * @param {string} workspaceID - Workspace ID/name
     * @returns {Promise<boolean>} Success status
     */
    async closeWorkspace(workspaceID) {
        debug(`Closing workspace: ${workspaceID}`);

        if (!this.#openWorkspaces.has(workspaceID)) {
            debug(`Workspace ${workspaceID} is not open`);
            return false;
        }

        const workspace = this.#openWorkspaces.get(workspaceID);

        try {
            await workspace.shutdown();

            // Mark workspace as inactive
            workspace.markAsInactive();

            this.#openWorkspaces.delete(workspaceID);

            this.emit('workspace:closed', workspace);
            debug(`Workspace ${workspaceID} closed successfully`);

            return true;
        } catch (err) {
            const error = new Error(`Failed to close workspace "${workspaceID}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Remove a workspace from the index (but not from disk)
     * @param {string} workspaceID - Workspace ID/name
     * @returns {Promise<boolean>} Success status
     */
    async removeWorkspace(workspaceID) {
        debug(`Removing workspace ${workspaceID} from index`);

        if (!this.#workspaceIndex.has(workspaceID)) {
            debug(`Workspace ${workspaceID} is not in the index`);
            return false;
        }

        // Close the workspace if it's open
        if (this.#openWorkspaces.has(workspaceID)) {
            await this.closeWorkspace(workspaceID);
        }

        // Remove from index
        this.#workspaceIndex.delete(workspaceID);

        this.emit('workspace:removed', workspaceID);
        debug(`Workspace ${workspaceID} removed from index`);

        return true;
    }

    /**
     * Mark a workspace as deleted (soft delete)
     * @param {string} workspaceID - Workspace ID/name
     * @param {Object} options - Options
     * @param {boolean} options.confirm - Confirmation flag
     * @returns {Promise<boolean>} Success status
     */
    async deleteWorkspace(workspaceID, options = {}) {
        debug(`Marking workspace ${workspaceID} as deleted`);

        // Require confirmation to prevent accidental deletion
        if (!options.confirm) {
            throw new Error('Confirmation required to delete workspace. Set options.confirm = true');
        }

        // Check if workspace exists
        if (!this.#workspaceIndex.has(workspaceID)) {
            // Try to load it first
            try {
                const workspace = await this.loadWorkspace(workspaceID);
                if (!workspace) {
                    debug(`Workspace ${workspaceID} not found, cannot delete`);
                    return false;
                }
            } catch (err) {
                debug(`Workspace ${workspaceID} not found, cannot delete: ${err.message}`);
                return false;
            }
        }

        const workspace = this.#workspaceIndex.get(workspaceID);

        // Close the workspace if it's open
        if (this.#openWorkspaces.has(workspaceID)) {
            await this.closeWorkspace(workspaceID);
        }

        try {
            // Mark workspace as deleted
            workspace.markAsDeleted();

            // If purge option is set, physically delete the workspace
            if (options.purge) {
                await this.purgeWorkspace(workspaceID);
            }

            this.emit('workspace:deleted', workspaceID);
            debug(`Workspace ${workspaceID} marked as deleted`);

            return true;
        } catch (err) {
            const error = new Error(`Failed to delete workspace "${workspaceID}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Physically delete a workspace from disk
     * @param {string} workspaceID - Workspace ID/name
     * @returns {Promise<boolean>} Success status
     */
    async purgeWorkspace(workspaceID) {
        const workspacePath = path.join(this.#rootPath, workspaceID);
        debug(`Purging workspace ${workspaceID} from disk at ${workspacePath}`);

        // Check if workspace exists in index
        if (this.#workspaceIndex.has(workspaceID)) {
            // Close the workspace if it's open
            if (this.#openWorkspaces.has(workspaceID)) {
                await this.closeWorkspace(workspaceID);
            }

            // Remove from index
            this.#workspaceIndex.delete(workspaceID);
        }

        try {
            // Delete workspace directory
            await fsPromises.rm(workspacePath, { recursive: true, force: true });

            this.emit('workspace:purged', workspaceID);
            debug(`Workspace ${workspaceID} purged from disk`);

            return true;
        } catch (err) {
            const error = new Error(`Failed to purge workspace "${workspaceID}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Check if a workspace is open
     * @param {string} workspaceID - Workspace ID/name
     * @returns {boolean} True if workspace is open
     */
    isOpen(workspaceID) {
        return this.#openWorkspaces.has(workspaceID);
    }

    /**
     * Check if a workspace exists in the index
     * @param {string} workspaceID - Workspace ID/name
     * @returns {boolean} True if workspace exists
     */
    hasWorkspace(workspaceID) {
        return this.#workspaceIndex.has(workspaceID);
    }

    /**
     * Check if a workspace exists on disk
     * @param {string} workspaceID - Workspace ID/name
     * @returns {boolean} True if workspace exists on disk
     */
    hasWorkspaceOnDisk(workspaceID) {
        const workspacePath = path.join(this.#rootPath, workspaceID);
        return existsSync(workspacePath);
    }

    /**
     * Get a workspace's configuration
     * @param {string} workspaceID - Workspace ID/name
     * @returns {Object|null} Workspace configuration or null
     */
    getWorkspaceConfig(workspaceID) {
        if (!this.#workspaceIndex.has(workspaceID)) {
            return null;
        }

        const workspace = this.#workspaceIndex.get(workspaceID);
        return workspace.config;
    }

    /**
     * Get a workspace instance
     * @param {string} workspaceID - Workspace ID/name
     * @returns {Promise<Workspace|null>} Workspace instance or null
     */
    async getWorkspace(workspaceID) {
        if (this.#workspaceIndex.has(workspaceID)) {
            return this.#workspaceIndex.get(workspaceID);
        }

        // Try to load the workspace
        return await this.loadWorkspace(workspaceID);
    }

    /**
     * List all workspaces
     * @returns {Array<Workspace>} Array of workspace instances
     */
    listWorkspaces() {
        return this.workspaces;
    }

    /**
     * List all open workspaces
     * @returns {Array<Workspace>} Array of open workspace instances
     */
    listOpenWorkspaces() {
        return this.openWorkspaces;
    }

    /**
     * Get a random color for workspace
     * @returns {string} Random color
     * @private
     */
    #getRandomColor() {
        return randomcolor({
            luminosity: 'light',
            format: 'hex'
        });
    }

    /**
     * Ensure a directory exists
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

    /**
     * Scan for existing workspaces
     * @returns {Promise<void>}
     * @private
     */
    async #scanWorkspaces() {
        debug(`Scanning for workspaces in ${this.#rootPath}`);

        try {
            const entries = await fsPromises.readdir(this.#rootPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const workspaceID = entry.name;
                    const workspacePath = path.join(this.#rootPath, workspaceID);

                    // Check if it's a valid workspace (has a config file)
                    const configPath = path.join(workspacePath, 'config', 'workspace.json');
                    if (existsSync(configPath)) {
                        try {
                            await this.loadWorkspace(workspaceID, workspacePath);
                            debug(`Found workspace: ${workspaceID}`);
                        } catch (err) {
                            debug(`Failed to load workspace ${workspaceID}: ${err.message}`);
                        }
                    }
                }
            }

            debug(`Found ${this.#workspaceIndex.size} workspaces`);
        } catch (err) {
            debug(`Error scanning workspaces: ${err.message}`);
        }
    }
}

export default WorkspaceManager;
