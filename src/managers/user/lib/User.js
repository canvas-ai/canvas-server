'use strict';

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('user');
import EventEmitter from 'eventemitter2';
import env from '@/env.js';

class User extends EventEmitter {
    #id;
    #email;
    #homePath;
    #workspaces = new Map();
    #sessions = new Map();
    #contexts = new Map();
    #devices = new Map();
    #roles = new Map();

    constructor(options = {}) {
        super();

        this.#id = options.id;
        this.#email = options.email;
        this.#homePath = options.homePath || path.join(env.CANVAS_USER_HOME, options.email);

        debug(`User instance created: ${this.#email}`);
    }

    async initialize() {
        debug(`Initializing user: ${this.#email}`);

        try {
            // Ensure user home directory exists
            await fs.mkdir(this.#homePath, { recursive: true });

            // Check if user.json exists, if not create it
            const userConfigPath = path.join(this.#homePath, 'user.json');
            if (!existsSync(userConfigPath)) {
                const userConfig = {
                    id: this.#id,
                    email: this.#email,
                    created: new Date().toISOString(),
                    updated: new Date().toISOString()
                };

                await fs.writeFile(
                    userConfigPath,
                    JSON.stringify(userConfig, null, 2)
                );

                debug(`Created user config at ${userConfigPath}`);
            }

            // Create workspaces directory if it doesn't exist
            const workspacesPath = path.join(this.#homePath, 'workspaces');
            await fs.mkdir(workspacesPath, { recursive: true });

            debug(`User initialized: ${this.#email}`);
        } catch (err) {
            debug(`Error initializing user: ${err.message}`);
            throw err;
        }
    }

    // Getters
    get id() { return this.#id; }
    get email() { return this.#email; }
    get homePath() { return this.#homePath; }

    // Workspace methods
    async addWorkspace(workspace) {
        this.#workspaces.set(workspace.id, workspace);
        this.emit('workspace:added', workspace);
    }

    getWorkspace(id) {
        return this.#workspaces.get(id);
    }

    listWorkspaces() {
        return Array.from(this.#workspaces.values());
    }

    // Session methods
    async addSession(session) {
        this.#sessions.set(session.id, session);
        this.emit('session:added', session);
    }

    getSession(id) {
        return this.#sessions.get(id);
    }

    listSessions() {
        return Array.from(this.#sessions.values());
    }

    // Context methods
    async addContext(context) {
        this.#contexts.set(context.id, context);
        this.emit('context:added', context);
    }

    getContext(id) {
        return this.#contexts.get(id);
    }

    listContexts() {
        return Array.from(this.#contexts.values());
    }

    // Device methods
    async addDevice(device) {
        this.#devices.set(device.id, device);
        this.emit('device:added', device);
    }

    getDevice(id) {
        return this.#devices.get(id);
    }

    listDevices() {
        return Array.from(this.#devices.values());
    }

    // Role methods
    async addRole(role) {
        this.#roles.set(role.id, role);
        this.emit('role:added', role);
    }

    getRole(id) {
        return this.#roles.get(id);
    }

    listRoles() {
        return Array.from(this.#roles.values());
    }

    toJSON() {
        return {
            id: this.#id,
            email: this.#email,
            homePath: this.#homePath
        };
    }
}

export default User;
