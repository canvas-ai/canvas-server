'use strict';

import Conf from 'conf';
import os from 'os';
import path from 'path';
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;
import debugInstance from 'debug';

const debug = debugInstance('canvas:cli:config');

// Define the configuration schema
const schema = {
    server: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                default: 'http://localhost:8001/rest/v2',
            },
        },
    },
    auth: {
        type: 'object',
        properties: {
            email: { type: 'string' },
            token: { type: 'string' },
        },
    },
    cli: {
        type: 'object',
        properties: {
            context: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    machineId: { type: 'string' },
                },
            },
            output: {
                type: 'object',
                properties: {
                    format: {
                        type: 'string',
                        enum: ['table', 'json'],
                        default: 'table',
                    },
                },
            },
        },
    },
};

// Define API endpoints
export const ENDPOINTS = {
    ping: '/ping',
    auth: {
        login: '/auth/login',
        tokens: '/auth/tokens',
        verify: '/auth/verify',
    },
    contexts: '/contexts',
    workspaces: '/workspaces',
    notes: '/notes',
};

// Define available modules
export const MODULES = ['context', 'workspace', 'notes'];

// Define HTTP methods for actions
export const ACTIONS = {
    list: 'get',
    get: 'get',
    create: 'post',
    update: 'put',
    delete: 'delete',
    add: 'post',
    remove: 'delete',
    set: 'put',
};

class Config {
    constructor() {
        if (Config.instance) {
            return Config.instance;
        }

        this.conf = new Conf({
            projectName: 'canvas-cli',
            schema,
        });

        Config.instance = this;
    }

    get(key) {
        return this.conf.get(key);
    }

    set(key, value) {
        this.conf.set(key, value);
    }

    has(key) {
        return this.conf.has(key);
    }

    delete(key) {
        this.conf.delete(key);
    }

    clear() {
        this.conf.clear();
    }

    save() {
        this.conf.save();
    }

    generateClientContext() {
        const context = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            machineId: machineIdSync(true),
            networkInterfaces: {},
        };

        // Get network interfaces
        const interfaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(interfaces)) {
            context.networkInterfaces[name] = addrs.map((addr) => ({
                address: addr.address,
                family: addr.family,
                internal: addr.internal,
            }));
        }

        return context;
    }
}

// Export singleton instance
export default new Config();
