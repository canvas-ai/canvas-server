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

import Workspace from './lib/Workspace.js';

export default class WorkspaceManager {

    #config;
    #workspaces;

    constructor(config) {
        this.#config = config;
        this.#workspaces = new Map();
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

    #parseWorkspaceId(id) {
        // Remove all non-alphanumeric characters except dot, underscore and dash
        id = id.replace(/[^a-zA-Z0-9_.-]/g, '');
        if (id.length === 0) {
            throw new Error('Invalid workspace ID');
        }

        return id;
    }

}
