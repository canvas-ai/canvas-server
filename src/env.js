/**
 * Canvas Server *single-user* env bootstrap
 */

// Utils
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
//import pkg from '../package.json' assert { type: 'json' };

// Constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_ROOT = path.dirname(path.resolve(__dirname));
const USER_HOME = process.env['CANVAS_USER_HOME'] || getUserHome();

const defaults = {
    // Runtime
    CANVAS_SERVER_MODE: process.env.CANVAS_SERVER_MODE || 'standalone',
    CANVAS_SERVER_PORTABLE: isPortable(),

    // Debug settings
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',

    /**
     * System directories
     *
     * SERVER_ROOT
     * ├── src
     * ├── config
     * ├── data
     * ├── extensions
     * |   ├── roles
     * |   ├── storage
     * |   ├── transports
     * ├── user
     * ├── var
     * |   ├── cache
     * |   ├── run
     * |   ├── log
     */

    CANVAS_SERVER_ROOT: SERVER_ROOT,
    CANVAS_SERVER_CONFIG: process.env['CANVAS_SERVER_CONFIG'] || path.join(SERVER_ROOT, 'config'),
    CANVAS_SERVER_DATA: process.env['CANVAS_SERVER_DATA'] || path.join(SERVER_ROOT, 'data'),
    CANVAS_SERVER_VAR: process.env['CANVAS_SERVER_VAR'] || path.join(SERVER_ROOT, 'var'),

    /**
     * User directories
     *
     * For portable mode, the user home is in server ./user, otherwise it's in the system's $HOME
     * User settings stored in ./config override server settings, moving your "home" folder to
     * another server instance(lets say from your local ws to your NAS) should be painless
     *
     * USER_HOME
     * ├── config
     * ├── cache
     * ├── data
     * |    ├── index
     * |    ├── db
     * ├── workspaces
     *      ├── universe
     *          ├── .workspace.json
     *          ├── index
     *      ├── foo
     */

    CANVAS_USER_HOME: USER_HOME,
    CANVAS_USER_CONFIG: process.env['CANVAS_USER_CONFIG'] || path.join(USER_HOME, 'config'),
    CANVAS_USER_CACHE: process.env['CANVAS_USER_CACHE'] || path.join(USER_HOME, 'cache'),
    CANVAS_USER_DATA: process.env['CANVAS_USER_DATA'] || path.join(USER_HOME, 'data'),
    CANVAS_USER_WORKSPACES: process.env['CANVAS_USER_WORKSPACES'] || path.join(USER_HOME, 'workspaces'),
};

// Transports (IPC, HTTP, WS): To remove
defaults.CANVAS_SERVER_IPC = (process.platform === 'win32') ?
    path.join('\\\\?\\pipe', 'canvas-server.ipc') :
    path.join(defaults.CANVAS_SERVER_VAR, 'run', 'canvas-server.sock');

// Initialize environment
const envPath = path.join(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

// If .env doesn't exist or is empty, create it with defaults
if (result.error || Object.keys(result.parsed || {}).length === 0) {
    const iniContent = Object.entries(defaults)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n');

    fs.writeFileSync(envPath, iniContent);
    // Reload env after creating file
    dotenv.config({ path: envPath });
}

// Set any missing defaults into process.env
Object.entries(defaults).forEach(([key, value]) => {
    process.env[key] = process.env[key] || value;
});

/**
 * Utils
 */

function isPortable() {
    return ! fs.existsSync(path.join(SERVER_ROOT, 'user', '.ignore'));
}

function getUserHome() {
    if (isPortable()) {
        return path.join(SERVER_ROOT, 'user');
    }

    if (process.platform === 'win32') {
        return path.join(os.homedir(), 'Canvas');
    }

    return path.join(os.homedir(), '.canvas');
}
