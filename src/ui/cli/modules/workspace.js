import BaseModule from '../lib/BaseModule.js';

class WorkspaceModule extends BaseModule {
    getEndpoints() {
        return {
            base: '/workspaces',
            current: '/workspaces/current',
        };
    }

    // Override methods for workspace-specific behavior
    async list(args = [], opts = {}) {
        const response = await this.api.get(this.endpoints.base);
        return this.handleResponse(response);
    }

    async get(args = [], opts = {}) {
        const response = await this.api.get(this.endpoints.current);
        return this.handleResponse(response);
    }

    async set(args = [], opts = {}) {
        if (!args[0]) {
            throw new Error('Workspace ID is required');
        }
        const workspaceId = args[0];

        const response = await this.api.put(this.endpoints.current, {
            id: workspaceId,
        });
        return this.handleResponse(response);
    }

    async create(args = [], opts = {}) {
        if (!args[0]) {
            throw new Error('Workspace name is required');
        }
        const name = args[0];
        const description = args[1] || '';

        const response = await this.api.post(this.endpoints.base, {
            name,
            description,
        });
        return this.handleResponse(response);
    }

    // Getters
    async id(args = [], opts = {}) {
        const workspace = await this.get();
        return workspace.id;
    }

    async name(args = [], opts = {}) {
        const workspace = await this.get();
        return workspace.name;
    }

    async path(args = [], opts = {}) {
        const workspace = await this.get();
        return workspace.path;
    }
}

export default WorkspaceModule;
