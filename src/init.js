/**
 * Canvas server init script
 * (single-user instance)
 */

// Imports
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Default paths
const SERVER_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const isPortable = () => fs.existsSync(path.join(SERVER_ROOT, 'user', '.portable'));
const getUserHome = () => {
    if (isPortable()) {
        return path.join(SERVER_ROOT, 'user');
    }
    return path.join(
        os.homedir(),
        process.platform === 'win32' ? 'Canvas' : '.canvas'
    );
};

const USER_HOME = process.env.CANVAS_USER_HOME || getUserHome();

/**
 * process.env overrides
 */

let envConfig = {
    // Runtime
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
    CANVAS_SERVER_MODE: process.env.CANVAS_SERVER_MODE || 'primary',

    // Server paths
    CANVAS_SERVER_ROOT: SERVER_ROOT,
    CANVAS_SERVER_CONFIG: process.env.CANVAS_SERVER_CONFIG || path.join(SERVER_ROOT, 'config'),
    CANVAS_SERVER_VAR: process.env.CANVAS_SERVER_CONFIG || path.join(SERVER_ROOT, 'var'),
    CANVAS_SERVER_ROLES: process.env.CANVAS_SERVER_ROLES || path.join(SERVER_ROOT, 'roles'),

    // User paths
    CANVAS_USER_HOME: USER_HOME,
    CANVAS_USER_CONFIG: process.env.CANVAS_USER_CONFIG || path.join(USER_HOME, 'config'),
    CANVAS_USER_CACHE: process.env.CANVAS_USER_CACHE || path.join(USER_HOME, 'cache'),
    CANVAS_USER_DATA: process.env.CANVAS_USER_DATA || path.join(USER_HOME, 'data'),
    CANVAS_USER_DB: process.env.CANVAS_USER_DB || path.join(USER_HOME, 'db'),
}

/**
 * .env overrides
 */

// Check for .env file
const envPath = path.join(SERVER_ROOT, '.env');
let envResult = dotenv.config({ path: envPath });

if (envResult.error || !Object.keys(envResult.parsed || {}).length) {
    const envContent = Object.entries(envConfig)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n');

    // If no .env file exists, create one
    fs.writeFileSync(envPath, envContent);

    // Reload env
    envResult = dotenv.config({ path: envPath });
}

// Merge .env values with defaults
Object.assign(envConfig, envResult.parsed);

// Ensure all config values are in process.env
Object.entries(envConfig).forEach(([key, value]) => {
    if (!process.env[key]) {
        process.env[key] = value;
    }
});

// if argv -> minimist (src/cli.js)

/**
 * Server initialization
 */

import CanvasServer from './Server.mjs';
const canvas = new CanvasServer({
    mode: envConfig.CANVAS_SERVER_MODE,
    paths: {
        server: {
            root: envConfig.CANVAS_SERVER_ROOT,
            config: envConfig.CANVAS_SERVER_CONFIG,
            var: envConfig.CANVAS_SERVER_VAR
        },
        user: {
            home: envConfig.CANVAS_USER_HOME,
            config: envConfig.CANVAS_USER_CONFIG,
            cache: envConfig.CANVAS_USER_CACHE,
            data: envConfig.CANVAS_USER_DATA,
            db: envConfig.CANVAS_USER_DB
        }
    }
});

// Start the server
await canvas.start();

// Event handlers
canvas.on('running', () => {
    console.log('Canvas server started successfully.');
});

canvas.on('error', (err) => {
    console.error('Canvas server failed to start.');
    console.error(err);
});
