// Imports
import path from 'path';
import { fileURLToPath } from 'url';
import argv from 'node:process';
import os from 'os';
import crypto from 'crypto';

// Runtime
const SERVER_MODE = argv.argv.slice(2).includes('--user') ? 'user' : 'standalone';

// Root paths
const SERVER_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVER_HOME = process.env.CANVAS_SERVER_HOME || getServerHome();
const USER_HOME = process.env.CANVAS_USER_HOME || getUserHome();

/**
 * Environment variables
 */

export const env = {
    server: {
        mode: SERVER_MODE,
        root: SERVER_ROOT,
        home: SERVER_HOME,
        logLevel: process.env.LOG_LEVEL || 'info',
        api: {
            enabled: process.env.CANVAS_DISABLE_API || true,
            protocol: process.env.CANVAS_API_PROTOCOL || 'http',
            port: process.env.CANVAS_API_PORT || 8001, // Needs to be changed in ./src/ui/web/.env ..for now
            host: process.env.CANVAS_API_HOST || '0.0.0.0'
        },
        web: {
            enabled: process.env.CANVAS_DISABLE_WEB || true,
            protocol: process.env.CANVAS_WEB_PROTOCOL || 'http',
            port: process.env.CANVAS_WEB_PORT || 8001,
            host: process.env.CANVAS_WEB_HOST || '0.0.0.0'
        }
    },
    user: {
        home: USER_HOME
    },
    auth: {
        // TODO: Use SERVER_HOME/config/auth.json for jwtSecret and tokenExpiry
        jwtSecret: process.env.CANVAS_JWT_SECRET || 'canvas-jwt-secret-change-in-production', //generateJwtSecret(),
        tokenExpiry: process.env.CANVAS_JWT_TOKEN_EXPIRY || '7d'
    },
    admin: {
        email: process.env.CANVAS_ADMIN_EMAIL || 'admin@universe.local',
        password: process.env.CANVAS_ADMIN_PASSWORD || null, // null will trigger auto-generation
        forceReset: process.env.CANVAS_ADMIN_RESET === 'true' || false
    }
}

/**
 * Private Utils
 */

function getServerHome() {
    if (SERVER_MODE === 'user') {
        const homeDir = os.homedir();
        if (process.platform === 'win32') {
            return path.join(homeDir, 'Canvas', 'server');
        } else {
            return path.join(homeDir, '.canvas', 'server');
        }
    } else {
        return path.join(SERVER_ROOT, 'server');
    }
}

function getUserHome() {
    if (SERVER_MODE === 'user') {
        const homeDir = os.homedir();
        if (process.platform === 'win32') {
            return path.join(homeDir, 'Canvas');
        } else {
            return path.join(homeDir, '.canvas');
        }
    }

    return path.join(SERVER_HOME, 'users');
}

function generateJwtSecret() {
    const randomSecret = crypto.randomBytes(64).toString('hex');
    console.log('[ENV] Generated random JWT secret (sessions will not persist across server restarts)');
    return randomSecret;
}
