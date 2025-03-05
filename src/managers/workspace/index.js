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
 */
class WorkspaceManager extends EventEmitter {

    #rootPath;
    #workspaceIndex = new Map();
    #openWorkspaces = new Map();
    #initialized = false;

    /**
     * Create a new WorkspaceManager instance
     * @param {Object} options - Configuration options
     * @param {string} options.rootPath - Root path for workspaces
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

    get rootPath() {
        return this.#rootPath;
    }

    get workspaces() {
        return this.#workspaceIndex;
    }

    get openWorkspaces() {
        return this.#openWorkspaces;
    }

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
            debug(`Workspace root directory ensured at ${this.#rootPath}`);
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
     * @param {string} name - Workspace name
     * @param {Object} options - Workspace options
     * @param {string} options.owner - User email (required)
     * @param {string} [options.label] - Display label for the workspace
     * @param {string} [options.description] - Workspace description
     * @param {string} [options.color] - Workspace color (hex format)
     * @param {boolean} [options.locked] - Whether the workspace is locked
     * @param {Object} [options.acl] - Access control list
     * @returns {Promise<Workspace>} - Created workspace
     * @throws {Error} If workspace creation fails
     */
    async createWorkspace(name, options = {}) {
        // Validate required parameters
        if (!name) {
            throw new Error('Workspace name is required');
        }

        if (!options.owner) {
            throw new Error('Workspace owner is required (options.owner)');
        }

        if (!options.owner.includes('@')) {
            throw new Error('Invalid owner email format');
        }

        if (options.type && !WORKSPACE_TYPES.includes(options.type)) {
            throw new Error(`Invalid workspace type: ${options.type}`);
        }

        // Create the workspace path
        const workspacePath = path.join(this.#rootPath, name);
        debug(`Creating workspace "${name}" for user ${options.owner} at ${workspacePath}`);

        try {
            // Check if workspace already exists
            if (existsSync(workspacePath)) {
                throw new Error(`Workspace directory already exists at ${workspacePath}`);
            }

            // Create workspace directory structure
            await this.#ensureDirectoryExists(workspacePath);

            // Create all workspace subdirectories defined in WORKSPACE_DIRECTORIES
            for (const [key, dirName] of Object.entries(WORKSPACE_DIRECTORIES)) {
                await this.#ensureDirectoryExists(path.join(workspacePath, dirName));
                debug(`Created workspace ${key} directory: ${dirName}`);
            }

            // Create workspace configuration
            const workspaceConfig = {
                id: options.id || uuidv4(),
                type: options.type || 'workspace',
                name: name,
                label: options.label || name.charAt(0).toUpperCase() + name.slice(1),
                description: options.description || `My ${name} workspace`,
                color: options.color || this.#getRandomColor(),
                locked: options.locked || false,
                owner: options.owner,
                acl: options.acl || {},
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                meta: options.meta || {},
            };

            // Create workspace instance
            const workspace = new Workspace({
                ...workspaceConfig,
                path: workspacePath,
            });

            // Initialize workspace
            await workspace.initialize();

            // Add to tracked workspaces - use just the name as the ID
            this.#workspaceIndex.set(name, workspace);

            this.emit('workspace:created', workspace.name);
            debug(`Workspace ${name} created successfully`);

            return workspace;
        } catch (err) {
            const error = new Error(`Failed to create workspace "${name}" for user ${options.owner}: ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Load a workspace from disk
     * @param {string} name - Workspace name
     * @returns {Promise<Workspace>} - Loaded workspace
     * @throws {Error} If workspace loading fails
     */
    async loadWorkspace(name) {
        debug(`Loading workspace: ${name}`);

        // Check if workspace is already loaded
        if (this.#workspaceIndex.has(name)) {
            debug(`Workspace ${name} is already loaded`);
            return this.#workspaceIndex.get(name);
        }

        const workspacePath = path.join(this.#rootPath, name);

        // Check if workspace directory exists
        if (!existsSync(workspacePath)) {
            throw new Error(`Workspace directory does not exist at ${workspacePath}`);
        }

        // Check if config directory exists
        const configDir = path.join(workspacePath, 'config');
        if (!existsSync(configDir)) {
            throw new Error(`No config directory found for workspace ${name}`);
        }

        try {
            // Create a temporary Conf instance to read the workspace config
            const configStore = new Conf({
                configName: 'workspace',
                cwd: workspacePath
            });

            // Check if the config has the required fields
            if (!configStore.has('owner')) {
                throw new Error(`Workspace ${name} has no owner defined`);
            }

            // Get all config data
            const configData = configStore.store;

            // Create a workspace instance without initializing
            const workspace = new Workspace({
                ...configData,
                path: workspacePath,
            });

            // Add to workspace index
            this.#workspaceIndex.set(name, workspace);
            debug(`Loaded workspace ${name} from ${workspacePath}`);

            this.emit('workspace:loaded', workspace.name);
            return workspace;
        } catch (err) {
            const error = new Error(`Failed to load workspace "${name}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Open a workspace (initialize database and resources)
     * @param {string} userID - User ID
     * @param {string} workspaceID - Workspace ID
     * @returns {Promise<Workspace>} - Opened workspace
     * @throws {Error} If workspace opening fails
     */
    async openWorkspace(userID, workspaceID) {
        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        const workspacePath = path.join(userPath, workspaceID);
        debug(`Opening workspace: ${workspacePath}`);

        // Check if workspace is already open
        if (this.#openWorkspaces.has(workspacePath)) {
            debug(`Workspace ${workspacePath} is already open`);
            return this.#openWorkspaces.get(workspacePath);
        }

        // Load the workspace if not already loaded
        let workspace;
        if (!this.#workspaceIndex.has(workspacePath)) {
            workspace = await this.loadWorkspace(workspacePath);
        } else {
            workspace = this.#workspaceIndex.get(workspacePath);
        }

        // Initialize the workspace
        try {
            await workspace.initialize();

            // Add to open workspaces
            this.#openWorkspaces.set(workspacePath, workspace);

            this.emit('workspace:opened', workspace.name);
            debug(`Workspace ${workspacePath} opened successfully`);

            return workspace;
        } catch (err) {
            const error = new Error(`Failed to open workspace "${workspacePath}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Close a workspace (shutdown database and resources)
     * @param {string} userID - User ID
     * @param {string} workspaceID - Workspace ID
     * @returns {Promise<boolean>} - True if workspace was closed
     */
    async closeWorkspace(userID, workspaceID) {
        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        const workspacePath = path.join(userPath, workspaceID);
        debug(`Closing workspace: ${workspacePath}`);

        if (!this.#openWorkspaces.has(workspacePath)) {
            debug(`Workspace ${workspacePath} is not open`);
            return false;
        }

        const workspace = this.#openWorkspaces.get(workspacePath);

        try {
            await workspace.shutdown();
            this.#openWorkspaces.delete(workspacePath);

            this.emit('workspace:closed', workspace.name);
            debug(`Workspace ${workspacePath} closed successfully`);

            return true;
        } catch (err) {
            const error = new Error(`Failed to close workspace "${workspacePath}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Remove a workspace from the index (but not from disk)
     * @param {string} userID - User ID
     * @param {string} workspaceID - Workspace ID
     * @returns {Promise<boolean>} - True if workspace was removed
     */
    async removeWorkspace(userID, workspaceID) {
        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        const workspacePath = path.join(userPath, workspaceID);
        debug(`Removing workspace ${workspacePath} from index`);

        if (!this.#workspaceIndex.has(workspacePath)) {
            debug(`Workspace ${workspacePath} is not in the index`);
            return false;
        }

        // Close the workspace if it's open
        if (this.#openWorkspaces.has(workspacePath)) {
            await this.closeWorkspace(userID, workspaceID);
        }

        // Remove from index
        this.#workspaceIndex.delete(workspacePath);

        this.emit('workspace:removed', workspacePath);
        debug(`Workspace ${workspacePath} removed from index`);

        return true;
    }

    /**
     * Delete a workspace (remove from index and delete from disk)
     * @param {string} userID - User ID
     * @param {string} workspaceID - Workspace ID
     * @param {Object} options - Delete options
     * @param {boolean} options.confirm - Confirmation flag (required)
     * @returns {Promise<boolean>} - True if workspace was deleted
     */
    async deleteWorkspace(userID, workspaceID, options = {}) {
        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        const workspacePath = path.join(userPath, workspaceID);
        debug(`Deleting workspace: ${workspacePath}`);

        // Require confirmation to prevent accidental deletion
        if (!options.confirm) {
            throw new Error('Confirmation required to delete workspace. Set options.confirm = true');
        }

        // Check if workspace exists
        if (!this.#workspaceIndex.has(workspacePath)) {
            // Try to load it first
            try {
                await this.loadWorkspace(workspacePath);
            } catch (err) {
                debug(`Workspace ${workspacePath} not found, cannot delete`);
                return false;
            }
        }

        // Close the workspace if it's open
        if (this.#openWorkspaces.has(workspacePath)) {
            await this.closeWorkspace(userID, workspaceID);
        }

        try {
            // Delete workspace directory
            await fsPromises.rm(workspacePath, { recursive: true, force: true });

            // Remove from index
            this.#workspaceIndex.delete(workspacePath);

            this.emit('workspace:deleted', workspacePath);
            debug(`Workspace ${workspacePath} deleted successfully`);

            return true;
        } catch (err) {
            const error = new Error(`Failed to delete workspace "${workspacePath}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Check if a workspace is open
     * @param {string} userID - User ID
     * @param {string} workspaceID - Workspace ID
     * @returns {boolean} - True if workspace is open
     */
    isOpen(userID, workspaceID) {
        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        const workspacePath = path.join(userPath, workspaceID);
        return this.#openWorkspaces.has(workspacePath);
    }

    /**
     * Check if a workspace exists in the index
     * @param {string} userID - User ID
     * @param {string} workspaceID - Workspace ID
     * @returns {boolean} - True if workspace exists
     */
    hasWorkspace(userID, workspaceID) {
        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        const workspacePath = path.join(userPath, workspaceID);
        return this.#workspaceIndex.has(workspacePath);
    }

    /**
     * Check if a workspace exists on disk
     * @param {string} userID - User ID
     * @param {string} workspaceID - Workspace ID
     * @returns {boolean} - True if workspace exists on disk
     */
    hasWorkspaceOnDisk(userID, workspaceID) {
        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        const workspacePath = path.join(userPath, workspaceID);
        return existsSync(workspacePath);
    }

    /**
     * Get workspace configuration without initializing it
     * @param {string} userID - User ID
     * @param {string} workspaceID - Workspace ID
     * @returns {Workspace} - Workspace instance (not initialized)
     */
    getWorkspaceConfig(userID, workspaceID) {
        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        const workspacePath = path.join(userPath, workspaceID);
        if (!this.#workspaceIndex.has(workspacePath)) {
            throw new Error(`Workspace with name "${workspacePath}" not found`);
        }

        return this.#workspaceIndex.get(workspacePath);
    }

    /**
     * Get workspace and automatically open it if not already initialized
     * @param {string} userID - User ID
     * @param {string} workspaceID - Workspace ID
     * @returns {Promise<Workspace>} - Initialized workspace instance
     */
    async getWorkspace(userID, workspaceID) {
        // Check if workspace is already open
        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        const workspacePath = path.join(userPath, workspaceID);
        if (this.#openWorkspaces.has(workspacePath)) {
            return this.#openWorkspaces.get(workspacePath);
        }

        // If not open, open it
        return this.openWorkspace(userID, workspaceID);
    }

    /**
     * List all workspaces for a specific user
     * @param {string} userID - User ID (email)
     * @returns {Array<Workspace>} - Array of workspace instances
     */
    listWorkspaces(userID) {
        if (!userID) {
            return Array.from(this.#workspaceIndex.values());
        }

        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        return Array.from(this.#workspaceIndex.values())
            .filter(workspace => workspace.path.startsWith(userPath));
    }

    /**
     * List all open workspaces for a specific user
     * @param {string} userID - User ID (email)
     * @returns {Array<Workspace>} - Array of open workspace instances
     */
    listOpenWorkspaces(userID) {
        const userPath = path.join(this.#rootPath, 'multiverse', userID);
        return Array.from(this.#openWorkspaces.values())
            .filter(workspace => workspace.path.startsWith(userPath));
    }

    /**
     * Scan for existing workspaces across all users
     * @private
     */
    async #scanWorkspaces() {
        debug(`Scanning ${this.#rootPath} for workspaces`);

        try {
            const multiversePath = path.join(this.#rootPath, 'multiverse');
            if (!existsSync(multiversePath)) {
                debug('Multiverse directory does not exist yet, no workspaces to scan');
                return;
            }

            // Scan user directories
            const userDirs = await fsPromises.readdir(multiversePath, { withFileTypes: true });
            debug(`Found ${userDirs.filter(dir => dir.isDirectory()).length} user directories`);

            for (const userDir of userDirs.filter(dir => dir.isDirectory())) {
                const userPath = path.join(multiversePath, userDir.name);
                const workspaceDirs = await fsPromises.readdir(userPath, { withFileTypes: true });

                for (const workspaceDir of workspaceDirs.filter(dir => dir.isDirectory())) {
                    const workspacePath = path.join(userPath, workspaceDir.name);
                    try {
                        // Load the workspace (but don't open it)
                        await this.loadWorkspace(workspacePath);
                    } catch (err) {
                        debug(`Error loading workspace ${workspacePath}: ${err.message}`);
                    }
                }
            }
        } catch (err) {
            debug(`Error scanning workspaces: ${err.message}`);
        }
    }

    /**
     * Ensure a directory exists, creating it if necessary
     * @param {string} dirPath - Path to ensure exists
     * @returns {Promise<void>}
     * @throws {Error} If directory creation fails
     */
    async #ensureDirectoryExists(dirPath) {
        try {
            // Check if directory exists first to avoid unnecessary operations
            if (!existsSync(dirPath)) {
                debug(`Creating directory: ${dirPath}`);
                await fsPromises.mkdir(dirPath, { recursive: true });
                debug(`Directory created: ${dirPath}`);
            } else {
                debug(`Directory already exists: ${dirPath}`);
            }

            // Verify directory is writable
            try {
                const testFile = path.join(dirPath, '.write-test');
                await fsPromises.writeFile(testFile, '');
                await fsPromises.unlink(testFile);
                debug(`Directory ${dirPath} is writable`);
            } catch (writeErr) {
                throw new Error(`Directory ${dirPath} is not writable: ${writeErr.message}`);
            }
        } catch (err) {
            debug(`Error ensuring directory ${dirPath}: ${err.message}`);
            throw err;
        }
    }

    /**
     * Get a random color
     * @param {Object} opts - Options for randomcolor
     * @returns {string} - Random color in hex format
     */
    #getRandomColor(opts = {}) {
        // https://www.npmjs.com/package/randomcolor
        return randomcolor(opts);
    }
}

export default WorkspaceManager;
