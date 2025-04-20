 'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import randomcolor from 'randomcolor';
import path from 'path';
import * as fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import Conf from 'conf';
import AdmZip from 'adm-zip';
import os from 'os';
import pm2 from 'pm2';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';


// Promisify PM2 functions
const pm2Connect = promisify(pm2.connect).bind(pm2);
const pm2Disconnect = promisify(pm2.disconnect).bind(pm2);
const pm2List = promisify(pm2.list).bind(pm2);
const pm2Start = promisify(pm2.start).bind(pm2);
const pm2Stop = promisify(pm2.stop).bind(pm2);
const pm2Delete = promisify(pm2.delete).bind(pm2);
const pm2Describe = promisify(pm2.describe).bind(pm2);

// Placeholder, descoped for now

class WorkspaceServer extends EventEmitter {
    constructor(options = {}) {
        super();
    }


    /**
     * Starts the dedicated REST API server for a workspace using PM2.
     * Requires 'write' access to the workspace.
     * @param {string} userID The ID of the user attempting the action.
     * @param {string} workspaceID The ID of the workspace.
     * @param {Object} apiConfig - Optional API configuration overrides.
     * @returns {Promise<boolean>} True if API started successfully, false otherwise or if access denied.
     */
    async startRestApi(userID, workspaceID, apiConfig = {}) {
        // Access Check: Requires write access to the workspace to manage its API
        if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to start REST API for workspace ${workspaceID}.`);
            return false;
        }

        debug(`Attempting to start REST API for workspace ${workspaceID}...`);
        // const indexEntry = this.index[workspaceID];
        const indexEntry = this.#findIndexEntry(workspaceID, userID);
        if (!indexEntry) {
            logger.error(`Cannot start REST API: Workspace ${workspaceID} not found in index array.`);
            return false;
        }

        if (
            indexEntry.restApiStatus === WORKSPACE_API_STATUS.RUNNING ||
            indexEntry.restApiStatus === WORKSPACE_API_STATUS.STARTING
        ) {
            logger.warn(`REST API for workspace ${workspaceID} is already ${indexEntry.restApiStatus}.`);
            return true;
        }

        // Load workspace config to get API port and token
        let port, token;
        try {
            const wsConfig = new Conf({ configName: 'workspace', cwd: indexEntry.rootPath });
            port = wsConfig.get('restApi.port');
            // Use provided token if valid, otherwise from config
            token =
                apiConfig.token && typeof apiConfig.token === 'string' && apiConfig.token.length >= 16
                    ? apiConfig.token
                    : wsConfig.get('restApi.token');
        } catch (err) {
            logger.error(`Failed to load workspace config for ${workspaceID} to start API: ${err.message}`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.ERROR }, userID);
            return false;
        }

        if (!port || !token) {
            logger.error(`Cannot start REST API for ${workspaceID}: Port or token not configured in workspace.json.`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.ERROR }, userID);
            return false;
        }

        const pm2Name = `canvas-wsapi-${workspaceID}`;
        const scriptPath = path.resolve('src/managers/workspace/server/service.js'); // Ensure absolute path?

        const options = {
            name: pm2Name,
            script: scriptPath,
            env: {
                CANVAS_WS_PATH: indexEntry.rootPath,
                CANVAS_WS_API_PORT: port,
                CANVAS_WS_API_TOKEN: token, // Pass the actual token
                NODE_ENV: process.env.NODE_ENV || 'development', // Pass environment
            },
            // PM2 options: restart strategy, logs, etc.
            autorestart: true,
            watch: false, // Don't watch by default, can cause issues
            max_memory_restart: '100M', // Example limit
        };

        try {
            await pm2Connect();
            logger.info(`Starting PM2 process "${pm2Name}" for workspace ${workspaceID} API...`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STARTING);
            // this.#index.set(`workspaces.${workspaceID}.pm2Name`, pm2Name);
            this.#updateIndexEntry(
                workspaceID,
                {
                    restApiStatus: WORKSPACE_API_STATUS.STARTING,
                    pm2Name: pm2Name,
                },
                userID,
            );

            await pm2Start(options);
            logger.info(`PM2 process "${pm2Name}" started successfully.`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.RUNNING);
            this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.RUNNING }, userID);
            this.emit('workspace:api:started', { id: workspaceID, name: pm2Name });
            return true;
        } catch (err) {
            logger.error(`Failed to start PM2 process "${pm2Name}" for workspace ${workspaceID}: ${err.message}`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            // this.#index.set(`workspaces.${workspaceID}.pm2Name`, null);
            this.#updateIndexEntry(
                workspaceID,
                {
                    restApiStatus: WORKSPACE_API_STATUS.ERROR,
                    pm2Name: null,
                },
                userID,
            );
            // Attempt to clean up failed start
            try {
                await pm2Delete(pm2Name);
            } catch (delErr) {
                /* Ignore delete error */
            }
            return false;
        } finally {
            await pm2Disconnect();
        }
    }

    /**
     * Stops the dedicated REST API server for a workspace using PM2.
     * Requires 'write' access to the workspace.
     * @param {string} userID The ID of the user attempting the action.
     * @param {string} workspaceID The ID of the workspace.
     * @returns {Promise<boolean>} True if API stopped successfully or was already stopped, false on error or access denied.
     */
    async stopRestApi(userID, workspaceID) {
        // Access Check: Requires write access to the workspace to manage its API
        if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to stop REST API for workspace ${workspaceID}.`);
            return false;
        }

        debug(`Attempting to stop REST API for workspace ${workspaceID}...`);
        // const indexEntry = this.index[workspaceID];
        const indexEntry = this.#findIndexEntry(workspaceID, userID);
        const pm2Name = indexEntry?.pm2Name;

        if (!pm2Name || indexEntry?.restApiStatus === WORKSPACE_API_STATUS.STOPPED) {
            debug(`REST API for workspace ${workspaceID} is not running or has no PM2 name associated.`);
            // Ensure index is consistent if status was wrong
            if (indexEntry && indexEntry.restApiStatus !== WORKSPACE_API_STATUS.STOPPED) {
                // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STOPPED);
                // this.#index.set(`workspaces.${workspaceID}.pm2Name`, null);
                this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.STOPPED, pm2Name: null }, userID);
            }
            return true; // Already stopped
        }

        try {
            await pm2Connect();
            logger.info(`Stopping PM2 process "${pm2Name}" for workspace ${workspaceID} API...`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STOPPING);
            this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.STOPPING }, userID);

            await pm2Stop(pm2Name);
            await pm2Delete(pm2Name); // Stop and delete to remove from list
            logger.info(`PM2 process "${pm2Name}" stopped and deleted successfully.`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STOPPED);
            // this.#index.set(`workspaces.${workspaceID}.pm2Name`, null);
            this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.STOPPED, pm2Name: null }, userID);
            this.emit('workspace:api:stopped', { id: workspaceID, name: pm2Name });
            return true;
        } catch (err) {
            logger.error(`Failed to stop/delete PM2 process "${pm2Name}" for workspace ${workspaceID}: ${err.message}`);
            // If stop/delete failed, the process might still exist.
            // Set status to error, keep pm2Name for potential manual cleanup?
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.ERROR }, userID);
            return false;
        } finally {
            await pm2Disconnect();
        }
    }

}

export default WorkspaceServer;
