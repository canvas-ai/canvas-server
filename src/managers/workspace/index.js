// Utils
import EventEmitter from 'eventemitter2';
import debugMessage from 'debug';
const debug = debugMessage('canvas:workspace-manager');
import randomcolor from 'randomcolor';
import path from 'path';
import fs from 'fs';

// DB Backend
import Db from '@synapsd/index'

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

    async createWorkspace(userEmail, name = 'universe') {
        if (!userEmail) {
            throw new Error('User email is required');
        }
        if (!userEmail.includes('@')) {
            throw new Error('Invalid user email format');
        }

        // Create the proper workspace path following the design:
        // /data/multiverse/user@email.tld/workspace_name
        const workspacePath = path.join(this.#rootPath, 'multiverse', userEmail, name);

        debug(`Creating workspace "${name}" for user ${userEmail} at ${workspacePath}`);

        // Create workspace directory if it doesn't exist
        await fs.promises.mkdir(workspacePath, { recursive: true });

        // Initialize store with the correct path
        const store = new WorkspaceStore(workspacePath);

        const workspace = new Workspace({
            userId: userEmail,
            name,
            path: workspacePath,
            store
        });

        // Add to tracked workspaces
        const proxiedWorkspace = this.#createProxiedWorkspace(workspace);
        this.#workspaces.set(`${userEmail}/${name}`, proxiedWorkspace);

        return workspace;
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
