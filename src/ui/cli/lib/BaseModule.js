/**
 * Base Module class for Canvas CLI modules
 * Provides common REST API interaction functionality
 */

'use strict';

import chalk from 'chalk';
import Table from 'cli-table3';
import debugInstance from 'debug';
import config, { ENDPOINTS, ACTIONS } from './Config.js';

const debug = debugInstance('canvas:cli:module');

class BaseModule {
    constructor(cli) {
        this.cli = cli;
        this.config = config;
        this.api = cli.api;
        this.debug = debug;
        this.endpoints = this.getEndpoints();
        this.clientContextArray = [];
        this.featureArray = [];
    }

    /**
     * Get module-specific endpoints
     * Should be overridden by module implementations
     */
    getEndpoints() {
        return {
            base: '/module-name', // Should be overridden
            // Add other module-specific endpoints here
        };
    }

    /**
     * Get the HTTP method to use for a given action
     */
    getMethodForAction(action) {
        return ACTIONS[action] || 'get';
    }

    /**
     * Format response data into a table
     */
    formatTable(data, options = {}) {
        const table = new Table({
            head: options.headers || [],
            style: {
                head: ['cyan'],
                border: ['grey'],
            },
        });

        if (Array.isArray(data)) {
            data.forEach((row) => {
                if (options.columns) {
                    table.push(options.columns.map((col) => row[col] || ''));
                } else {
                    table.push(Object.values(row));
                }
            });
        } else if (typeof data === 'object') {
            if (options.columns) {
                table.push(options.columns.map((col) => data[col] || ''));
            } else {
                table.push(Object.values(data));
            }
        }

        return table.toString();
    }

    /**
     * Format response data as JSON
     */
    formatJson(data) {
        return JSON.stringify(data, null, 2);
    }

    /**
     * Format response data based on output format
     */
    formatOutput(data, options = {}) {
        const format = options.format || this.config.get('cli.output.format') || 'table';

        if (format === 'json') {
            return this.formatJson(data);
        }

        return this.formatTable(data, options);
    }

    /**
     * Handle API response
     */
    handleResponse(response, options = {}) {
        if (!response || !response.data) {
            throw new Error('Invalid response from server');
        }

        if (response.data.status === 'error') {
            throw new Error(response.data.message || 'Unknown error occurred');
        }

        const data = response.data.payload || response.data;

        if (options.raw) {
            return data;
        }

        return this.formatOutput(data, options);
    }

    /**
     * Handle API error
     */
    handleError(error) {
        this.debug('API error:', error);

        if (error.response) {
            this.debug('Response status:', error.response.status);
            this.debug('Response data:', error.response.data);

            if (error.response.data && error.response.data.message) {
                console.error(chalk.red(`Error: ${error.response.data.message}`));
                return;
            }
        }

        console.error(chalk.red(`Error: ${error.message}`));
    }

    /**
     * Execute an API request
     */
    async executeRequest(action, endpoint, options = {}) {
        try {
            const method = this.getMethodForAction(action);
            const response = await this.api.request({
                method,
                url: endpoint,
                data: options.data,
                params: options.params,
            });

            return this.handleResponse(response, options);
        } catch (error) {
            this.handleError(error);
            return null;
        }
    }

    /**
     * Default action handlers
     */
    async list(args = [], opts = {}) {
        const response = await this.api.get(this.endpoints.base);
        return this.handleResponse(response);
    }

    async get(args = [], opts = {}) {
        if (!args[0]) {
            throw new Error('ID is required');
        }
        const response = await this.api.get(`${this.endpoints.base}/${args[0]}`);
        return this.handleResponse(response);
    }

    async add(args = [], opts = {}, data = null) {
        const payload = {
            ...opts,
            content: data || args.join(' '),
        };
        const response = await this.api.post(this.endpoints.base, payload);
        return this.handleResponse(response);
    }

    async update(args = [], opts = {}, data = null) {
        if (!args[0]) {
            throw new Error('ID is required');
        }
        const payload = {
            ...opts,
            content: data || args.slice(1).join(' '),
        };
        const response = await this.api.put(`${this.endpoints.base}/${args[0]}`, payload);
        return this.handleResponse(response);
    }

    async delete(args = [], opts = {}) {
        if (!args[0]) {
            throw new Error('ID is required');
        }
        const response = await this.api.delete(`${this.endpoints.base}/${args[0]}`);
        return this.handleResponse(response);
    }

    /**
     * Action aliases
     */

    async rm(...args) {
        return this.delete(...args);
    }
    async del(...args) {
        return this.delete(...args);
    }
    async remove(...args) {
        return this.delete(...args);
    }
    async insert(...args) {
        return this.add(...args);
    }
    async ls(...args) {
        return this.list(...args);
    }
}

export default BaseModule;
