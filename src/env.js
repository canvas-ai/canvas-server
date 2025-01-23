// Imports
import os from 'os';
import { existsSync } from 'fs';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import argv from 'node:process';

// Utils
const isPortable = () => existsSync(path.join(SERVER_ROOT, 'user'));
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
    CANVAS_SERVER_MODE: process.env.CANVAS_SERVER_MODE || argv.argv.slice(2).includes('--local') ? 'local' : 'remote',

    // Server paths
    CANVAS_SERVER_HOME: SERVER_HOME,
    CANVAS_SERVER_CONFIG: process.env.CANVAS_SERVER_CONFIG || path.join(SERVER_HOME, 'config'),
    CANVAS_SERVER_CACHE: process.env.CANVAS_SERVER_CACHE || path.join(SERVER_HOME, 'cache'),
    CANVAS_SERVER_DATA: process.env.CANVAS_SERVER_DATA || path.join(SERVER_HOME, 'data'),
    CANVAS_SERVER_DB: process.env.CANVAS_SERVER_DB || path.join(SERVER_HOME, 'db'),
    CANVAS_SERVER_VAR: process.env.CANVAS_SERVER_VAR || path.join(SERVER_HOME, 'var'),
    CANVAS_SERVER_ROLES: process.env.CANVAS_SERVER_ROLES || path.join(SERVER_HOME, 'roles'),
    CANVAS_SERVER_WORKSPACES: process.env.CANVAS_SERVER_WORKERS || path.join(SERVER_HOME, 'workspaces'),

    // User paths (portable/single-user local mode)
    CANVAS_USER_HOME: USER_HOME, // For remote mode, USER_HOME is set to CANVAS_SERVER_WORKSPACES/user@email.tld
    CANVAS_USER_CONFIG: process.env.CANVAS_USER_CONFIG || path.join(USER_HOME, 'config'),
    CANVAS_USER_CACHE: process.env.CANVAS_USER_CACHE || path.join(USER_HOME, 'cache'),
    CANVAS_USER_DATA: process.env.CANVAS_USER_DATA || path.join(USER_HOME, 'data'),
    CANVAS_USER_DB: process.env.CANVAS_USER_DB || path.join(USER_HOME, 'db'),
    CANVAS_USER_VAR: process.env.CANVAS_USER_VAR || path.join(USER_HOME, 'var'),
    CANVAS_USER_ROLES: process.env.CANVAS_USER_VAR || path.join(USER_HOME, 'roles')
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
 * Initialize environment
 */

function env() {
    const envPath = path.join(SERVER_ROOT, '.env');
    let envResult = dotenv.config({ path: envPath });

    // Only create .env if it doesn't exist
    if (envResult.error && !existsSync(envPath)) {
        const envContent = Object.entries(envConfig)
            .map(([key, value]) => `${key}="${value}"`)
            .join('\n');

        try {
            writeFileSync(envPath, envContent);
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

// Return the current env configuration
export default env();
