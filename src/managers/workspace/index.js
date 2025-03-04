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

            this.emit('workspace:created', workspace);
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
    async load(name) {
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

            this.emit('workspace:loaded', workspace);
            return workspace;
        } catch (err) {
            const error = new Error(`Failed to load workspace "${name}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Open a workspace (initialize database and resources)
     * @param {string} name - Workspace name
     * @returns {Promise<Workspace>} - Opened workspace
     * @throws {Error} If workspace opening fails
     */
    async open(name) {
        debug(`Opening workspace: ${name}`);

        // Check if workspace is already open
        if (this.#openWorkspaces.has(name)) {
            debug(`Workspace ${name} is already open`);
            return this.#openWorkspaces.get(name);
        }

        // Load the workspace if not already loaded
        let workspace;
        if (!this.#workspaceIndex.has(name)) {
            workspace = await this.load(name);
        } else {
            workspace = this.#workspaceIndex.get(name);
        }

        // Initialize the workspace
        try {
            await workspace.initialize();

            // Add to open workspaces
            this.#openWorkspaces.set(name, workspace);

            this.emit('workspace:opened', workspace);
            debug(`Workspace ${name} opened successfully`);

            return workspace;
        } catch (err) {
            const error = new Error(`Failed to open workspace "${name}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Close a workspace (shutdown database and resources)
     * @param {string} name - Workspace name
     * @returns {Promise<boolean>} - True if workspace was closed
     */
    async close(name) {
        debug(`Closing workspace: ${name}`);

        if (!this.#openWorkspaces.has(name)) {
            debug(`Workspace ${name} is not open`);
            return false;
        }

        const workspace = this.#openWorkspaces.get(name);

        try {
            await workspace.shutdown();
            this.#openWorkspaces.delete(name);

            this.emit('workspace:closed', name);
            debug(`Workspace ${name} closed successfully`);

            return true;
        } catch (err) {
            const error = new Error(`Failed to close workspace "${name}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Remove a workspace from the index (but not from disk)
     * @param {string} name - Workspace name
     * @returns {Promise<boolean>} - True if workspace was removed
     */
    async remove(name) {
        debug(`Removing workspace ${name} from index`);

        if (!this.#workspaceIndex.has(name)) {
            debug(`Workspace ${name} is not in the index`);
            return false;
        }

        // Close the workspace if it's open
        if (this.#openWorkspaces.has(name)) {
            await this.close(name);
        }

        // Remove from index
        this.#workspaceIndex.delete(name);

        this.emit('workspace:removed', name);
        debug(`Workspace ${name} removed from index`);

        return true;
    }

    /**
     * Delete a workspace (remove from index and delete from disk)
     * @param {string} name - Workspace name
     * @param {Object} options - Delete options
     * @param {boolean} options.confirm - Confirmation flag (required)
     * @returns {Promise<boolean>} - True if workspace was deleted
     */
    async delete(name, options = {}) {
        debug(`Deleting workspace: ${name}`);

        // Require confirmation to prevent accidental deletion
        if (!options.confirm) {
            throw new Error('Confirmation required to delete workspace. Set options.confirm = true');
        }

        // Check if workspace exists
        if (!this.#workspaceIndex.has(name)) {
            // Try to load it first
            try {
                await this.load(name);
            } catch (err) {
                debug(`Workspace ${name} not found, cannot delete`);
                return false;
            }
        }

        // Close the workspace if it's open
        if (this.#openWorkspaces.has(name)) {
            await this.close(name);
        }

        // Get workspace path
        const workspacePath = path.join(this.#rootPath, name);

        try {
            // Delete workspace directory
            await fsPromises.rm(workspacePath, { recursive: true, force: true });

            // Remove from index
            this.#workspaceIndex.delete(name);

            this.emit('workspace:deleted', name);
            debug(`Workspace ${name} deleted successfully`);

            return true;
        } catch (err) {
            const error = new Error(`Failed to delete workspace "${name}": ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Check if a workspace is open
     * @param {string} name - Workspace name
     * @returns {boolean} - True if workspace is open
     */
    isOpen(name) {
        return this.#openWorkspaces.has(name);
    }

    /**
     * Check if a workspace exists in the index
     * @param {string} name - Workspace name
     * @returns {boolean} - True if workspace exists
     */
    hasWorkspace(name) {
        return this.#workspaceIndex.has(name);
    }

    /**
     * Check if a workspace exists on disk
     * @param {string} name - Workspace name
     * @returns {boolean} - True if workspace exists on disk
     */
    hasWorkspaceOnDisk(name) {
        const workspacePath = path.join(this.#rootPath, name);
        return existsSync(workspacePath);
    }

    /**
     * Get workspace configuration without initializing it
     * @param {string} name - Workspace name
     * @returns {Workspace} - Workspace instance (not initialized)
     */
    getWorkspaceConfig(name) {
        if (!this.#workspaceIndex.has(name)) {
            throw new Error(`Workspace with name "${name}" not found`);
        }

        return this.#workspaceIndex.get(name);
    }

    /**
     * Get workspace and automatically open it if not already initialized
     * @param {string} name - Workspace name
     * @returns {Promise<Workspace>} - Initialized workspace instance
     */
    async getWorkspace(name) {
        // Check if workspace is already open
        if (this.#openWorkspaces.has(name)) {
            return this.#openWorkspaces.get(name);
        }

        // If not open, open it
        return this.open(name);
    }

    /**
     * List all workspaces
     * @returns {Array<Workspace>} - Array of workspace instances
     */
    listWorkspaces() {
        return Array.from(this.#workspaceIndex.values());
    }

    /**
     * List all open workspaces
     * @returns {Array<Workspace>} - Array of open workspace instances
     */
    listOpenWorkspaces() {
        return Array.from(this.#openWorkspaces.values());
    }

    /**
     * Get workspaces for a user
     * @param {string} userEmail - User email
     * @returns {Array<Workspace>} - Array of workspace instances
     */
    getUserWorkspaces(userEmail) {
        return Array.from(this.#workspaceIndex.values())
            .filter(workspace => workspace.owner === userEmail);
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

    async #scanWorkspaces() {
        debug(`Scanning ${this.#rootPath} for workspaces`);

        try {
            // Get all workspace directories directly from rootPath
            if (!existsSync(this.#rootPath)) {
                debug('Workspace root directory does not exist yet, no workspaces to scan');
                return; // No workspaces to scan yet
            }

            // Get all workspace directories
            const workspaceDirs = await fsPromises.readdir(this.#rootPath, { withFileTypes: true });
            debug(`Found ${workspaceDirs.filter(dir => dir.isDirectory()).length} workspace directories`);

            for (const workspaceDir of workspaceDirs.filter(dir => dir.isDirectory())) {
                const workspaceName = workspaceDir.name;

                try {
                    // Load the workspace (but don't open it)
                    await this.load(workspaceName);
                } catch (err) {
                    debug(`Error loading workspace ${workspaceName}: ${err.message}`);
                }
            }
        } catch (err) {
            debug(`Error scanning workspaces: ${err.message}`);
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
