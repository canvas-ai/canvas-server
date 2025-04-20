'use strict';

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
// Use console for logging in this simple service
const logPrefix = '[WorkspaceService]';
const debug = (...args) => console.debug(logPrefix, ...args);
const info = (...args) => console.info(logPrefix, ...args);
const warn = (...args) => console.warn(logPrefix, ...args);
const error = (...args) => console.error(logPrefix, ...args);
const fatal = (...args) => {
    console.error(logPrefix, 'FATAL:', ...args);
};

import Workspace from '../lib/Workspace.js';
import authenticateToken from './auth.js';
import createApiRoutes from './routes.js';
import Conf from 'conf'; // Needed to instantiate Workspace

const WORKSPACE_PATH = process.env.CANVAS_WS_PATH;
const API_PORT = process.env.CANVAS_WS_API_PORT || 3000;
const AUTH_TOKEN = process.env.CANVAS_WS_API_TOKEN || 'test-api-token'; // This holds the actual token

if (!WORKSPACE_PATH) {
    fatal('Missing required environment variables: CANVAS_WS_PATH, CANVAS_WS_API_PORT, CANVAS_WS_API_TOKEN');
    process.exit(1);
}

// Resolve the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UI_PATH = path.resolve(__dirname, 'ui');

let workspaceInstance = null;
let serverInstance = null; // To keep track of the HTTP server

async function startServer() {
    info(`Starting dedicated server for workspace at: ${WORKSPACE_PATH}`);
    info(`API Port: ${API_PORT}, Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Missing'}`);

    try {
        // 1. Load Workspace Config (workspace.json)
        const configStore = new Conf({
            configName: 'workspace',
            cwd: WORKSPACE_PATH,
        });
        const workspaceConfig = configStore.store;
        if (!workspaceConfig || !workspaceConfig.id) {
            throw new Error(`Invalid or missing workspace config found at ${WORKSPACE_PATH}`);
        }
        info('Workspace config loaded successfully.');

        // 2. Instantiate the Workspace
        workspaceInstance = new Workspace({
            ...workspaceConfig,
            path: WORKSPACE_PATH, // Ensure path is passed correctly
            configStore: configStore,
        });
        info(`Workspace instance created for ID: ${workspaceInstance.id}`);

        // 3. Start the Workspace (initialize DB, etc.)
        await workspaceInstance.start();
        info(`Workspace ${workspaceInstance.id} started successfully.`);

        // 4. Setup Express Server
        const app = express();
        app.use(express.json());

        // Serve static files from the 'ui' directory
        info(`Serving static UI files from: ${UI_PATH}`);
        app.use(express.static(UI_PATH));

        // Redirect root to index.html
        app.get('/', (req, res) => {
            res.redirect('/index.html');
        });

        // Add a simple health check endpoint (unauthenticated)
        app.get('/health', (req, res) => {
            // Check if workspace is still considered open/active
            const wsStatus = workspaceInstance.status;
            res.status(200).json({
                status: 'ok',
                workspaceId: workspaceInstance?.id || 'unknown',
                workspaceStatus: wsStatus,
            });
        });

        // Apply authentication middleware TO API ROUTES ONLY
        const apiRouter = createApiRoutes(workspaceInstance);
        app.use('/api/v1', authenticateToken(AUTH_TOKEN), apiRouter); // Mount API under /api/v1

        // 5. Start Listening
        serverInstance = app.listen(API_PORT, () => {
            info(`Workspace ${workspaceInstance.id} REST API listening on port ${API_PORT}`);
            info(`Server started for workspace ${workspaceInstance.id}`);
            // Notify pm2 that the process is ready (if running under pm2)
            if (process.send) {
                process.send('ready');
            }
        });

        serverInstance.on('error', (error) => {
            fatal(`Server error for workspace ${workspaceInstance?.id || WORKSPACE_PATH}: ${error.message}`, error);
            // Attempt graceful shutdown before exiting
            shutdownServer(1); // Pass error code
        });
    } catch (error) {
        fatal(`Failed to start workspace server for ${WORKSPACE_PATH}: ${error.message}`, error);
        process.exit(1);
    }
}

async function shutdownServer(exitCode = 0) {
    info(`Shutting down workspace server for ${workspaceInstance?.id || WORKSPACE_PATH} with code ${exitCode}...`);

    // Close the HTTP server first to stop accepting new connections
    if (serverInstance) {
        serverInstance.close(() => {
            info('HTTP server closed.');
        });
        serverInstance = null; // Prevent multiple closes
    }

    // Stop the workspace instance
    if (workspaceInstance) {
        try {
            await workspaceInstance.stop();
            info(`Workspace ${workspaceInstance.id} stopped.`);
        } catch (err) {
            error(`Error stopping workspace ${workspaceInstance.id} during shutdown: ${err.message}`);
        }
    }
    // Add any other cleanup needed
    info(`Shutdown complete for workspace server ${workspaceInstance?.id || WORKSPACE_PATH}. Exiting.`);
    process.exit(exitCode);
}

// Handle graceful shutdown
process.on('SIGINT', () => shutdownServer(0));
process.on('SIGTERM', () => shutdownServer(0));

// Handle errors that might slip through
process.on('uncaughtException', (error, origin) => {
    fatal(`Uncaught exception in workspace server (${workspaceInstance?.id || WORKSPACE_PATH}): ${error.message}`, {
        error,
        origin,
    });
    shutdownServer(1); // Attempt graceful shutdown on fatal error
});
process.on('unhandledRejection', (reason, promise) => {
    fatal(`Unhandled rejection in workspace server (${workspaceInstance?.id || WORKSPACE_PATH}): ${reason}`, { promise });
    shutdownServer(1); // Attempt graceful shutdown on fatal error
});

startServer();
