// Utils
import EventEmitter from 'eventemitter2';
import debugMessage from 'debug';
const debug = debugMessage('canvas:context:workspace-manager');
import randomcolor from 'randomcolor';

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
        this.#loadWorkspacesSync(); // do we need to load all workspaces?
    }

    createWorkspace(userId, options = {}) {
        if (!userId) { throw new Error('User ID is required'); }
        if (typeof userId !== 'string') { throw new Error('User ID must be a string'); }

        options.name = this.#parseWorkspaceId(options.name);
        options = this.#validateWorkspaceOptions(options);

        // if user workspaces has the workspace, return it
        const userWorkspace = new WorkspaceStore(userId).get(options.name);
        if (userWorkspace) {
            return userWorkspace;
        }

        // if (this.#workspaces.has(id)) {
        //     throw new Error(`Workspace with id "${id}" already exists, use getWorkspace(id) to retrieve it`); // Maybe we should just return the workspace right away?
        // }

        debug(`Creating workspace with name "${options.name}" for user "${userId}"`);
        const workspace = new Workspace(options.name, options);
        const proxiedWorkspace = this.#createProxiedWorkspace(workspace);
        this.#workspaces.set(options.name, proxiedWorkspace);

        new WorkspaceStore(userId).set(options.name, workspace);

        this.#saveWorkspacesSync();
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
                this.#saveWorkspacesSync(); // Save workspaces after any property change
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
