// Utils
import EventEmitter from 'eventemitter2';
import debugMessage from 'debug';
const debug = debugMessage('canvas:workspace-manager');
import randomcolor from 'randomcolor';
import path from 'path';
import fs from 'fs';

// DB Backend
import Db from '../../services/synapsd/src/index.js'

// Includes
import Workspace from './lib/Workspace.js';
import WorkspaceStore from './store/index.js';

export default class WorkspaceManager extends EventEmitter {

    #rootPath;
    #index;
    #openWorkspaces;
    #workspaces = new Map(); // just to prevent error, TODO: Make this a JsonMap

    constructor(options = {}) {
        super(); // EventEmitter

        if (!options.rootPath) { throw new Error('Root path is required'); }
        this.#rootPath = options.rootPath;

        // Lists all found workspaces in #rootPath
        this.#index = new Map(); // I think this is not needed
        // Lists all open workspaces
        this.#openWorkspaces = new Map();

        this.initialize()
    }

    initialize() {
        this.#scanWorkspaces();
    }

    #scanWorkspaces() {
        debug(`Scanning ${this.#rootPath} for workspaces`);
        
        try {
            // Get all directories in rootPath
            const items = fs.readdirSync(this.#rootPath, { withFileTypes: true });
            const directories = items.filter(item => item.isDirectory());

            for (const dir of directories) {
                const workspacePath = path.join(this.#rootPath, dir.name);
                const configPath = path.join(workspacePath, 'workspace.json');

                if (fs.existsSync(configPath)) {
                    try {
                        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                        const workspace = new Workspace(dir.name, {
                            ...configData,
                            path: workspacePath
                        });
                        const proxiedWorkspace = this.#createProxiedWorkspace(workspace);
                        this.#workspaces.set(dir.name, proxiedWorkspace);
                        debug(`Loaded workspace from ${configPath}`);
                    } catch (err) {
                        debug(`Error loading workspace config from ${configPath}: ${err.message}`);
                    }
                }
            }
        } catch (err) {
            debug(`Error scanning workspaces: ${err.message}`);
        }
    }

    createWorkspace(userId, workspaceId, options = {}) {
        if (!userId) { throw new Error('User ID is required'); }
        if (typeof userId !== 'string') { throw new Error('User ID must be a string'); }
        if (!workspaceId) { throw new Error('Workspace ID is required'); }
        if (typeof workspaceId !== 'string') { throw new Error('Workspace ID must be a string'); }

        workspaceId = this.#parseWorkspaceId(workspaceId);
        options = this.#validateWorkspaceOptions(options);

        const workspacePath = path.join(this.#rootPath, workspaceId);
        const configPath = path.join(workspacePath, 'workspace.json');

        // Check if workspace folder exists
        if (!fs.existsSync(workspacePath)) {
            debug(`Creating workspace directory at ${workspacePath}`);
            fs.mkdirSync(workspacePath, { recursive: true });
        }

        // if user workspaces has the workspace, return it
        const userWorkspace = new WorkspaceStore(userId).get(workspaceId);
        if (userWorkspace) {
            return userWorkspace;
        }

        debug(`Creating workspace with ID "${workspaceId}" for user "${userId}"`);
        const workspace = new Workspace(workspaceId, {
            ...options,
            path: workspacePath
        });
        
        // Save workspace configuration to its folder
        const configData = {
            id: workspace.id,
            name: workspace.name,
            description: workspace.description,
            baseUrl: workspace.baseUrl,
            color: workspace.color,
            // path is intentionally omitted as it's dynamic
        };

        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
        
        const proxiedWorkspace = this.#createProxiedWorkspace(workspace);
        this.#workspaces.set(workspaceId, proxiedWorkspace);

        new WorkspaceStore(userId).set(workspaceId, workspace);
        return proxiedWorkspace;
    }

    getWorkspace(id) {
        if (!this.#workspaces.has(id)) {
            throw new Error(`Workspace with id "${id}" not found`);
        }

        return this.#workspaces.get(id);
    }

    hasWorkspace(id) {
        return this.#workspaces.has(id);
    }

    listWorkspaces() {
        return this.#workspaces.values();
    }

    importWorkspace(workspacePath) { /** Wont implement atm */ }

    exportWorkspace(workspaceId, workspacePath) { /** Wont implement atm */ }

    #loadWorkspacesSync() {
        debug('Loading workspaces from store');
        const data = this.#index.get('workspaces'); // We can do better here
        if (data) {
            const workspaces = JSON.parse(data);
            for (const id in workspaces) {
                const workspace = new Workspace(workspaces[id]);
                const proxiedWorkspace = this.#createProxiedWorkspace(workspace);
                this.#workspaces.set(id, proxiedWorkspace);
            }
        }
    }

    #saveWorkspacesSync() {
        const data = {};
        for (const [id, workspace] of this.#workspaces) {
            data[id] = {
                id: workspace.id,
                name: workspace.name,
                description: workspace.description,
                baseUrl: workspace.baseUrl,
                color: workspace.color,
                path: workspace.path
            };
        }
        debug('Saving workspaces to store');
        this.#index.set('workspaces', JSON.stringify(data, null, 2));
    }

    #createProxiedWorkspace(workspace) {
        const handler = {
            set: (target, property, value) => {
                target[property] = value;
                debug('Workspace update detected for ID ', target.id);
                
                // Save configuration to workspace.json
                const configPath = path.join(target.path, 'workspace.json');
                const configData = {
                    id: target.id,
                    name: target.name,
                    description: target.description,
                    baseUrl: target.baseUrl,
                    color: target.color,
                };
                
                fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
                return true;
            }
        };
        return new Proxy(workspace, handler);
    }

    #validateWorkspaceOptions(options) {
        if (options.color) {
            if (!this.#isValidHexColor(options.color)) {
                throw new Error('Invalid color format');
            }
        } else { options.color = this.#getRandomColor(); }  // Not really a validate kinda thing

        if (options.baseUrl && !this.#isValidUrl(options.baseUrl)) {
            throw new Error('Invalid base URL format, use an absolute URL "/foo/bar/baz"');
        }

        if (options.name && typeof options.name !== 'string') {
            throw new Error('Invalid workspace name');
        }

        if (options.description && typeof options.description !== 'string') {
            throw new Error('Invalid workspace description');
        }

        return options;
    }

    #parseWorkspaceId(id) {
        // work.mb
        // work.acme
        // .work.acme

        // Remove leading dot
        id = id.replace(/^\./, '');
        // Remove all non-alphanumeric characters except dot, underscore and dash
        id = id.replace(/[^a-zA-Z0-9_-]/g, '');
        id = id.trim();
        if (id.length === 0) { throw new Error('Invalid workspace ID'); }
        id = id.toLowerCase();
        return id;
    }

    #isValidHexColor(color) {
        const hexColorRegex = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i;
        return hexColorRegex.test(color);
    }

    #isValidUrl(url) {
        const urlRegex = /^\/(?:[a-z0-9_-]+(?:\/[a-z0-9_-]+)*)?$/i;
        return urlRegex.test(url);
    }

    #getRandomColor(opts = {}) {
        // https://www.npmjs.com/package/randomcolor
        return randomcolor(opts);
    }
}
