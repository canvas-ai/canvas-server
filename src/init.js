/**
 * Canvas server init script
 */

// Imports
import os from 'os';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import argv from 'node:process';

// Utils
const isPortable = () => existsSync(path.join(SERVER_ROOT, 'user', '.portable'));
const getUserHome = () => {
    if (isPortable()) {
        return path.join(SERVER_ROOT, 'user');
    }

    return process.env.CANVAS_USER_HOME || path.join(
        os.homedir(),
        process.platform === 'win32' ? 'Canvas' : '.canvas'
    );
};

// Root paths
const SERVER_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVER_HOME = process.env.CANVAS_SERVER_HOME || path.join(SERVER_ROOT, 'server');
const USER_HOME = getUserHome();

/**
 * Default environment configuration
 */

const envConfig = {
    // Runtime
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
    CANVAS_SERVER_MODE: process.env.CANVAS_SERVER_MODE || argv.argv.slice(2).includes('--minimal') ? 'minimal' : 'full',

    // Server paths
    CANVAS_SERVER_HOME: SERVER_HOME,
    CANVAS_SERVER_CONFIG: process.env.CANVAS_SERVER_CONFIG || path.join(SERVER_HOME, 'config'),
    CANVAS_SERVER_CACHE: process.env.CANVAS_SERVER_CACHE || path.join(SERVER_HOME, 'cache'),
    CANVAS_SERVER_DATA: process.env.CANVAS_SERVER_DATA || path.join(SERVER_HOME, 'data'),
    CANVAS_SERVER_VAR: process.env.CANVAS_SERVER_VAR || path.join(SERVER_HOME, 'var'),
    CANVAS_SERVER_ROLES: process.env.CANVAS_SERVER_ROLES || path.join(SERVER_HOME, 'roles'),

    // User paths
    CANVAS_USER_HOME: USER_HOME,
    CANVAS_USER_CONFIG: process.env.CANVAS_USER_CONFIG || path.join(USER_HOME, 'config'),
    CANVAS_USER_CACHE: process.env.CANVAS_USER_CACHE || path.join(USER_HOME, 'cache'),
    CANVAS_USER_DATA: process.env.CANVAS_USER_DATA || path.join(USER_HOME, 'data'),
    CANVAS_USER_DB: process.env.CANVAS_USER_DB || path.join(USER_HOME, 'db'),
    CANVAS_USER_VAR: process.env.CANVAS_USER_VAR || path.join(USER_HOME, 'var')
};

/**
 * Ensure all required directories exist
 */

async function ensureDirectories(paths) {
    for (const [key, dir] of Object.entries(paths)) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (err) {
            throw new Error(`Failed to create ${key} directory at ${dir}: ${err.message}`);
        }
    }
}

/**
 * Initialize environment configuration
 */

async function initializeEnv() {
    const envPath = path.join(SERVER_ROOT, '.env');
    let envResult = dotenv.config({ path: envPath });

    // Only create .env if it doesn't exist
    if (envResult.error && !existsSync(envPath)) {
        const envContent = Object.entries(envConfig)
            .map(([key, value]) => `${key}="${value}"`)
            .join('\n');

        try {
            await fs.writeFile(envPath, envContent);
            envResult = dotenv.config({ path: envPath });
        } catch (err) {
            throw new Error(`Failed to create .env file: ${err.message}`);
        }
    }

    // Merge .env values with defaults
    const finalConfig = { ...envConfig, ...(envResult.parsed || {}) };

    // Update process.env with final values
    Object.entries(finalConfig).forEach(([key, value]) => {
        process.env[key] = value;
    });

    return finalConfig;
}

/**
 * Main server initialization
 */

async function main() {
    try {
        // Initialize environment
        const config = await initializeEnv();

        // Ensure required directories exist
        // TODO: Refactor or remove altogether
        await ensureDirectories({
            serverHome: config.CANVAS_SERVER_HOME,
            serverConfig: config.CANVAS_SERVER_CONFIG,
            serverCache: config.CANVAS_SERVER_CACHE,
            serverData: config.CANVAS_SERVER_DATA,
            serverVar: config.CANVAS_SERVER_VAR,
            serverRoles: config.CANVAS_SERVER_ROLES,
            userHome: config.CANVAS_USER_HOME,
            userConfig: config.CANVAS_USER_CONFIG,
            userCache: config.CANVAS_USER_CACHE,
            userData: config.CANVAS_USER_DATA,
            userDb: config.CANVAS_USER_DB,
            userVar: config.CANVAS_USER_VAR
        });

        // Import server after environment is configured
        const { default: CanvasServer } = await import('./Server.mjs');

        const canvas = new CanvasServer({
            mode: config.CANVAS_SERVER_MODE,
            paths: {
                server: {
                    home: config.CANVAS_SERVER_HOME,
                    config: config.CANVAS_SERVER_CONFIG,
                    cache: config.CANVAS_SERVER_CACHE,
                    data: config.CANVAS_SERVER_DATA,
                    var: config.CANVAS_SERVER_VAR,
                    roles: config.CANVAS_SERVER_ROLES
                },
                user: {
                    home: config.CANVAS_USER_HOME,
                    config: config.CANVAS_USER_CONFIG,
                    cache: config.CANVAS_USER_CACHE,
                    data: config.CANVAS_USER_DATA,
                    db: config.CANVAS_USER_DB,
                    var: config.CANVAS_SERVER_VAR
                }
            }
        });

        // Register event handlers before starting
        canvas.on('running', () => {
            console.log('Canvas server started successfully.');
        });

        canvas.on('error', (err) => {
            console.error('Canvas server failed to start:', err);
            process.exit(1);
        });

        // Handle process signals
        const shutdown = async (signal) => {
            console.log(`Received ${signal}. Shutting down gracefully...`);
            try {
                await canvas.stop();
                process.exit(0);
            } catch (err) {
                console.error('Error during shutdown:', err);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Start the server
        await canvas.start();

    } catch (err) {
        console.error('Failed to initialize Canvas server:', err);
        process.exit(1);
    }
}

// Run the application
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
