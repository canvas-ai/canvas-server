import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const SERVER_MODE = process.env.CANVAS_SERVER_MODE || 'standalone';
const SERVER_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Utils
const isPortable = () => fs.existsSync(path.join(SERVER_ROOT, 'user', '.portable'));
const createPathConfig = (base, paths) =>
    Object.fromEntries(
        paths.map(([key, subpath]) => [
            key,
            process.env[key] || path.join(base, subpath)
        ])
    );
const getUserHome = () => {
    if (isPortable()) {
        return path.join(SERVER_ROOT, 'user');
    }
    return path.join(
        os.homedir(),
        process.platform === 'win32' ? 'Canvas' : '.canvas'
    );
};

// Determine user home directory
const USER_HOME = process.env.CANVAS_USER_HOME || getUserHome();

/**
 * Example portable setup
 * /Canvas
 *  ├── Server
 *  |   ├── config
 *  |   ├── data
 *  |   ├── var
 *  ├── UI
 *  |   ├── config
 *  |   |   ├── electron
 *  |   |   ├── cli
 * /Roles               # Docker container based roles
 * /Workspaces          # -> CANVAS_USER_HOME/Workspaces
 *  ├── Universe
 *  |   ├── .workspace.json
 *  |   ├── .workspace
 *  |   |   ├── data
 *  |   ├── Desktop     # Legacy data
 *  |   ├── Downloads   # Legacy data
 *  |   ├── Documents   # Legacy data
 *  ├── CustomerA
 *  |   ├── .workspace.json
 *  |   ├── .workspace
 *  |   |   ├── data
 *  |   ├── Apps        # Legacy data (AppImages/PortableApps and profile folders for apps)
 *  |   ├── Desktop     # Legacy data
 *  |   ├── Downloads   # Legacy data
 *  |   ├── Documents   # Legacy data
 */

// Env path configuration
const config = {
    // Runtime settings
    CANVAS_SERVER_MODE: process.env.CANVAS_SERVER_MODE || 'standalone',
    CANVAS_SERVER_PORTABLE: isPortable(),
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',

    /**
     * System directories
     *
     * SERVER_ROOT
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
    ...createPathConfig(SERVER_ROOT, [
        ['CANVAS_SERVER_ROOT', ''],
        ['CANVAS_SERVER_CONFIG', 'config'],
        ['CANVAS_SERVER_DATA', 'data'],
        ['CANVAS_SERVER_VAR', 'var']
    ]),

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
    ...createPathConfig(USER_HOME, [
        ['CANVAS_USER_HOME', ''],
        ['CANVAS_USER_CONFIG', 'config'],
        ['CANVAS_USER_CACHE', 'cache'],
        ['CANVAS_USER_DATA', 'data'],
        ['CANVAS_USER_WORKSPACES', 'workspaces']
    ]),

    // Transport configuration
    CANVAS_SERVER_IPC: process.platform === 'win32'
        ? path.join('\\\\?\\pipe', 'canvas-server.ipc')
        : path.join(SERVER_ROOT, 'var', 'run', 'canvas-server.sock')
};

// Load and manage .env file
const envPath = path.join(SERVER_ROOT, '.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error || !Object.keys(envResult.parsed || {}).length) {
    const envContent = Object.entries(config)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n');

    fs.writeFileSync(envPath, envContent);
    dotenv.config({ path: envPath });
}

// Ensure all config values are in process.env
Object.entries(config).forEach(([key, value]) => {
    process.env[key] = process.env[key] || value;
});

export default config;
