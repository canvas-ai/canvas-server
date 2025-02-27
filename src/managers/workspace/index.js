// Utils
import EventEmitter from 'eventemitter2';
import randomcolor from 'randomcolor';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
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

    constructor(options = {}) {
        super(); // EventEmitter

        debug('Initializing workspace manager');
        this.#rootPath = options.rootPath || env.CANVAS_USER_HOME;
        debug(`Workspace root path: ${this.#rootPath}`);
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug('Initializing workspace manager');

        // Ensure root path exists
        try {
            await fs.mkdir(this.#rootPath, { recursive: true });
            debug(`Workspace root directory created at ${this.#rootPath}`);
        } catch (err) {
            debug(`Error creating workspace root directory: ${err.message}`);
            throw err;
        }

        // Scan for existing workspaces
        await this.#scanWorkspaces();

        this.#initialized = true;
    }

    async #scanWorkspaces() {
        debug(`Scanning ${this.#rootPath} for workspaces`);

        try {
            // Get all directories in rootPath/multiverse
            const multiversePath = path.join(this.#rootPath, 'multiverse');

            // Create multiverse directory if it doesn't exist
            if (!existsSync(multiversePath)) {
                await fs.mkdir(multiversePath, { recursive: true });
                debug(`Created multiverse directory at ${multiversePath}`);
                return; // No workspaces to scan yet
            }

            // Get all user directories
            const userDirs = await fs.readdir(multiversePath, { withFileTypes: true });

            for (const userDir of userDirs.filter(dir => dir.isDirectory())) {
                const userEmail = userDir.name;
                const userPath = path.join(multiversePath, userEmail);
                const workspacesPath = path.join(userPath, 'workspaces');

                if (!existsSync(workspacesPath)) {
                    continue;
                }

                // Get all workspace directories
                const workspaceDirs = await fs.readdir(workspacesPath, { withFileTypes: true });

                for (const workspaceDir of workspaceDirs.filter(dir => dir.isDirectory())) {
                    const workspaceName = workspaceDir.name;
                    const workspacePath = path.join(workspacesPath, workspaceName);
                    const configPath = path.join(workspacePath, 'workspace.json');

                    if (existsSync(configPath)) {
                        try {
                            const configData = JSON.parse(await fs.readFile(configPath, 'utf8'));
                            const workspace = new Workspace({
                                ...configData,
                                path: workspacePath,
                                ownerId: userEmail
                            });

                            const workspaceId = `${userEmail}/${workspaceName}`;
                            this.#workspaceIndex.set(workspaceId, workspace);
                            debug(`Loaded workspace ${workspaceId} from ${configPath}`);
                        } catch (err) {
                            debug(`Error loading workspace config from ${configPath}: ${err.message}`);
                        }
                    }
                }
            }
        } catch (err) {
            debug(`Error scanning workspaces: ${err.message}`);
        }
    }

    /**
     * Create a new workspace for a user
     * @param {string} userEmail - User email
     * @param {string} name - Workspace name
     * @param {Object} options - Workspace options
     * @returns {Promise<Workspace>} - Created workspace
     */
    async createWorkspace(userEmail, name = 'universe', options = {}) {
        if (!userEmail) {
            throw new Error('User email is required');
        }

        if (!userEmail.includes('@')) {
            throw new Error('Invalid user email format');
        }

        // Create the proper workspace path following the design:
        // /data/multiverse/user@email.tld/workspaces/workspace_name
        const userPath = path.join(this.#rootPath, 'multiverse', userEmail);
        const workspacesPath = path.join(userPath, 'workspaces');
        const workspacePath = path.join(workspacesPath, name);

        debug(`Creating workspace "${name}" for user ${userEmail} at ${workspacePath}`);

        // Create workspace directory structure
        await fs.mkdir(workspacePath, { recursive: true });
        await fs.mkdir(path.join(workspacePath, 'db'), { recursive: true });
        await fs.mkdir(path.join(workspacePath, 'config'), { recursive: true });

        // Create workspace configuration
        const workspaceConfig = {
            id: options.id || uuidv4(),
            type: name === 'universe' ? 'universe' : 'workspace',
            name: name,
            label: options.label || (name === 'universe' ? 'Universe' : name.charAt(0).toUpperCase() + name.slice(1)),
            description: options.description || (name === 'universe' ? 'And then, there was geometry..' : `My ${name} workspace`),
            color: options.color || (name === 'universe' ? '#fff' : this.#getRandomColor()),
            locked: name === 'universe', // Universe workspace is locked by default
            owner: userEmail,
            acl: options.acl || {},
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        // Write workspace configuration
        await fs.writeFile(
            path.join(workspacePath, 'workspace.json'),
            JSON.stringify(workspaceConfig, null, 2)
        );

        // Create workspace instance
        const workspace = new Workspace({
            ...workspaceConfig,
            path: workspacePath
        });

        // Initialize workspace
        await workspace.initialize();

        // Add to tracked workspaces
        const workspaceId = `${userEmail}/${name}`;
        this.#workspaceIndex.set(workspaceId, workspace);

        this.emit('workspace:created', workspace);

        return workspace;
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

    /**
     * Validate hex color
     * @param {string} color - Color in hex format
     * @returns {boolean} - True if valid hex color
     */
    #isValidHexColor(color) {
        const hexColorRegex = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i;
        return hexColorRegex.test(color);
    }
}

export default WorkspaceManager;
