import BaseModule from '../lib/BaseModule.js';
import chalk from 'chalk';

// Config
import config from '../lib/Config.js';
// Logging
import debugInstance from 'debug';
const debug = debugInstance('canvas:cli');

class ContextModule extends BaseModule {
    constructor(cli) {
        super(cli);
    }

    getEndpoints() {
        return {
            base: '/contexts',
            current: '/contexts/current',
            tree: '/contexts/tree',
            path_array: '/contexts/path_array',
        };
    }

    // Override methods for context-specific behavior
    async list(args = [], opts = {}) {
        debug('Listing contexts');
        const response = await this.api.get(this.endpoints.base);
        const data = response.data.payload;
        console.log(data);
        return data;
    }

    async get(args = [], opts = {}) {
        const response = await this.api.get(this.endpoints.current);
        const data = response.data.payload;
        console.log(data);
        return data;
    }

    async set(args = [], opts = {}) {
        if (!args[0]) {
            throw new Error('Context path is required');
        }
        const contextPath = args[0];

        const response = await this.api.put(this.endpoints.current, {
            path: contextPath,
        });
        const data = response.data.payload;
        console.log(data);
        return data;
    }

    // Getters
    async url(args = [], opts = {}) {
        const context = await this.get();
        return context.url;
    }

    async id(args = [], opts = {}) {
        const context = await this.get();
        return context.id;
    }

    async path(args = [], opts = {}) {
        const context = await this.get();
        return context.path;
    }

    async path_array() {
        const response = await this.api.get(`${this.endpoints.base}/path_array`);
        const data = response.data.payload;
        console.log(data);
        return data;
    }

    async tree(args = [], opts = {}) {
        const response = await this.api.get(this.endpoints.tree);
        const data = response.data.payload;
        console.log(data);
        return data;
    }

    async switch(args = [], opts = {}) {
        if (!args[0]) {
            throw new Error('Context ID is required');
        }
        const contextId = args[0];
        const response = await this.api.put(`${this.endpoints.base}/${contextId}/switch`, {});
        const data = response.data.payload;
        console.log(data);
        return data;
    }
}

export default ContextModule;
