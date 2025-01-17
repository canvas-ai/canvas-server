/*

Workspace
- own data sources
- own db/cache
=> own directory structure
- (most probably) own context tree
=> Once implemented, we might need to create a "virtual" top-level context tree for data analytics

Workspace "work" with its context tree + indexes then may (or may not) be a visible part of the top level "universe" context tree
Anyhow, to keep things simple, we will have the universe for now

Url structure (workspace ID + context ID + context URL):
Workspace
    universe | baseUrl / | Color #fff
        :ws
        :phone
        :nb
    work | baseUrl /work | Color #000
        :ws
        :phone
    work.foo | baseUrl /work/customer-foo | Color #cba (optional naming, we'll probably allow dots in workspace names)
        :ws
        :phone

canvas://universe:ws/home/edu/cuni/apma3
canvas://work.foo:ws/work/customer-foo/reports/2021

? workspace/contextID? (work:mb/phone) or phone@workspace/context/url (phone@work/foo/home/edu/cuni/apma3)
ws@universe:/home/edu/cuni/apma3
I can connect my browser to ws@universe and open its tabs
hm
should work (as in, be practical) :)

*/

<<<<<<< HEAD
=======
// Includes
import ContextManager from '../../Server.js';
>>>>>>> origin/dev
import Workspace from './lib/Workspace.js';

export default class WorkspaceManager {

<<<<<<< HEAD
    #config;
    #workspaces;

    constructor(config) {
        this.#config = config;
        this.#workspaces = new Map();
=======
    #rootPath;
    #index;
    #openWorkspaces;
    #workspaces = new Map(); // just to prevent error, TODO: Make this a JsonMap

    constructor(options = {}) {
        super(); // EventEmitter


        if (!options.rootPath) { throw new Error('Root path is required'); }
        this.#rootPath = options.rootPath;

        // Lists all found workspaces in #rootPath
        this.#index = new Map();
        // Lists all open workspaces
        this.#openWorkspaces = new Map();

        this.initialize()
    }

    initialize() {
        this.#loadWorkspacesSync();
>>>>>>> origin/dev
    }

    createWorkspace(id, options = {}) {
        if (!id) { return new Workspace(); }
        if (this.#workspaces.has(id)) {
            throw new Error(`Workspace with id "${id}" already exists`);
        }

        const workspace = new Workspace(id, options);
        this.#workspaces.set(id, workspace);

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

<<<<<<< HEAD
=======
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

>>>>>>> origin/dev
    #parseWorkspaceId(id) {
        // Remove all non-alphanumeric characters except dot, underscore and dash
        id = id.replace(/[^a-zA-Z0-9_.-]/g, '');
        if (id.length === 0) {
            throw new Error('Invalid workspace ID');
        }

        return id;
    }

}
