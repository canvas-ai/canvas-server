// Utils
import EventEmitter from 'eventemitter2';
import randomcolor from 'randomcolor';
import path from 'path';
import * as fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Logging
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('workspace-manager');

// Environment
import env from '@/env.js';

// Includes
import Workspace from './lib/Workspace.js';

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
                const workspacePath = path.join(this.#rootPath, workspaceName);
                const configPath = path.join(workspacePath, 'workspace.json');

                if (existsSync(configPath)) {
                    try {
                        const configData = JSON.parse(await fsPromises.readFile(configPath, 'utf8'));

                        // Ensure owner is defined in the config
                        if (!configData.owner) {
                            debug(`Workspace ${workspaceName} has no owner defined, skipping`);
                            continue;
                        }

                        const workspace = new Workspace({
                            ...configData,
                            path: workspacePath,
                        });

                        const workspaceId = `${configData.owner}/${workspaceName}`;
                        this.#workspaceIndex.set(workspaceId, workspace);
                        debug(`Loaded workspace ${workspaceId} from ${configPath}`);
                    } catch (err) {
                        debug(`Error loading workspace config from ${configPath}: ${err.message}`);
                    }
                } else {
                    debug(`No workspace.json found for ${workspaceName} at ${configPath}`);
                }
            }
        } catch (err) {
            debug(`Error scanning workspaces: ${err.message}`);
        }
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

        // Check if this is a universe workspace and if one already exists for this user
        if (name === 'universe' || options.type === 'universe') {
            const existingUniverses = Array.from(this.#workspaceIndex.values())
                .filter(ws => ws.owner === options.owner && ws.type === 'universe');

            if (existingUniverses.length > 0) {
                throw new Error(`User ${options.owner} already has a universe workspace`);
            }
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
            await this.#ensureDirectoryExists(path.join(workspacePath, 'db'));
            await this.#ensureDirectoryExists(path.join(workspacePath, 'config'));
            await this.#ensureDirectoryExists(path.join(workspacePath, 'data'));
            await this.#ensureDirectoryExists(path.join(workspacePath, 'cache'));
            await this.#ensureDirectoryExists(path.join(workspacePath, 'dotfiles'));

            // Determine if this is a universe workspace
            const isUniverse = name === 'universe' || options.type === 'universe';

            // Create workspace configuration
            const workspaceConfig = {
                id: options.id || uuidv4(),
                type: isUniverse ? 'universe' : 'workspace',
                name: name,
                label: options.label || (isUniverse ? 'Universe' : name.charAt(0).toUpperCase() + name.slice(1)),
                description: options.description || (isUniverse ? 'And then, there was geometry..' : `My ${name} workspace`),
                color: options.color || (isUniverse ? '#fff' : this.#getRandomColor()),
                locked: options.locked || isUniverse, // Universe workspace is locked by default
                owner: options.owner,
                acl: options.acl || {},
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
            };

            // Write workspace configuration
            const configPath = path.join(workspacePath, 'workspace.json');
            await fsPromises.writeFile(
                configPath,
                JSON.stringify(workspaceConfig, null, 2)
            );
            debug(`Workspace configuration written to ${configPath}`);

            // Create workspace instance
            const workspace = new Workspace({
                ...workspaceConfig,
                path: workspacePath,
            });

            // Initialize workspace
            await workspace.initialize();

            // Add to tracked workspaces
            const workspaceId = `${options.owner}/${name}`;
            this.#workspaceIndex.set(workspaceId, workspace);

            this.emit('workspace:created', workspace);
            debug(`Workspace ${workspaceId} created successfully`);

            return workspace;
        } catch (err) {
            const error = new Error(`Failed to create workspace "${name}" for user ${options.owner}: ${err.message}`);
            debug(error.message);
            throw error;
        }
    }

    /**
     * Get workspace by ID
     * @param {string} id - Workspace ID (format: userEmail/workspaceName)
     * @returns {Workspace} - Workspace instance
     */
    getWorkspace(id) {
        if (!this.#workspaceIndex.has(id)) {
            throw new Error(`Workspace with id "${id}" not found`);
        }

        return this.#workspaceIndex.get(id);
    }

    /**
     * Check if workspace exists
     * @param {string} id - Workspace ID
     * @returns {boolean} - True if workspace exists
     */
    hasWorkspace(id) {
        return this.#workspaceIndex.has(id);
    }

    /**
     * List all workspaces
     * @returns {Array<Workspace>} - Array of workspace instances
     */
    listWorkspaces() {
        return Array.from(this.#workspaceIndex.values());
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
     * Open a workspace
     * @param {string} id - Workspace ID
     * @returns {Promise<Workspace>} - Opened workspace
     */
    async openWorkspace(id) {
        const workspace = this.getWorkspace(id);

        if (this.#openWorkspaces.has(id)) {
            return this.#openWorkspaces.get(id);
        }

        await workspace.initialize();
        this.#openWorkspaces.set(id, workspace);

        this.emit('workspace:opened', workspace);

        return workspace;
    }

    /**
     * Close a workspace
     * @param {string} id - Workspace ID
     * @returns {Promise<boolean>} - True if workspace was closed
     */
    async closeWorkspace(id) {
        if (!this.#openWorkspaces.has(id)) {
            return false;
        }

        const workspace = this.#openWorkspaces.get(id);
        await workspace.shutdown();

        this.#openWorkspaces.delete(id);
        this.emit('workspace:closed', id);

        return true;
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
