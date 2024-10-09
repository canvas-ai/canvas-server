/**
 * Canvas Server *single-user* env bootstrap
 */

// Utils
const path = require('path');
const fs = require('fs');
const os = require('os');
const pkg = require('../package.json');

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
 * |   ├── log
 * |   ├── run
 */

const SERVER_ROOT = path.dirname(path.resolve(__dirname));

// Server directories
const SERVER_CONFIG = process.env['CANVAS_SERVER_CONFIG'] || path.join(SERVER_ROOT, 'config');
const SERVER_DATA = process.env['CANVAS_SERVER_DATA'] || path.join(SERVER_ROOT, 'data');
const SERVER_VAR = process.env['CANVAS_SERVER_VAR'] || path.join(SERVER_ROOT, 'var');
const SERVER_EXT = process.env['CANVAS_SERVER_EXT'] || path.join(SERVER_ROOT, 'extensions');

// User directories
// For portable mode, the user home is in server ./user, otherwise it's in the system home
// User settings stored in ./config override server settings, moving your "home" folder to
// another server instance(lets say from your local ws to your NAS) should be as painless as possible
const CANVAS_USER_HOME = process.env['CANVAS_USER_HOME'] || getUserHome();
const CANVAS_USER_CONFIG = process.env['CANVAS_USER_CONFIG'] || path.join(CANVAS_USER_HOME, 'config');
// User "Universe"
const CANVAS_USER_INDEX = process.env['CANVAS_USER_INDEX'] || path.join(CANVAS_USER_HOME, 'index');
const CANVAS_USER_DB = process.env['CANVAS_USER_DB'] || path.join(CANVAS_USER_HOME, 'db');
const CANVAS_USER_CACHE = process.env['CANVAS_USER_CACHE'] || path.join(CANVAS_USER_HOME, 'cache');
const CANVAS_USER_DATA = process.env['CANVAS_USER_DATA'] || path.join(CANVAS_USER_HOME, 'data');
// User workspaces
const CANVAS_USER_WORKSPACES = process.env['CANVAS_USER_WORKSPACES'] || path.join(CANVAS_USER_HOME, 'workspaces');

// Collect all ENV constants
const env = {
    filePath: path.join(SERVER_ROOT, '.env'),
    isPortable: isPortable(),

    app: {
        name: pkg.productName,
        version: pkg.version,
        description: pkg.description,
        license: pkg.license,
        // Maybe we should use a commonapp.paths {} here, so that
        // the higher level modules don't have to decide whether to use
        // a server or a user path
    },

    server: {
        paths: {
            root: SERVER_ROOT,
            config: SERVER_CONFIG,
            data: SERVER_DATA,
            ext: SERVER_EXT,
            var: SERVER_VAR,
        },
    },

    user: {
        paths: {
            home: CANVAS_USER_HOME,
            config: CANVAS_USER_CONFIG,
            index: CANVAS_USER_INDEX,
            db: CANVAS_USER_DB,
            cache: CANVAS_USER_CACHE,
            data: CANVAS_USER_DATA,
            workspaces: CANVAS_USER_WORKSPACES,
        },
    },

    pid: path.join(SERVER_VAR, 'run', 'canvas-server.pid'),
    ipc: (process.platform === 'win32') ?
        path.join('\\\\?\\pipe', 'canvas-server.ipc') :
        path.join(SERVER_VAR, 'run', 'canvas-server.sock'),

};

// Generate a .env ini file (needed for external server roles)
const ini = {
    // Runtime
    CANVAS_RUNTIME: 'server',
    CANVAS_PORTABLE: env.isPortable,

    // App
    CANVAS_APP_NAME: env.app.name,
    CANVAS_APP_VERSION: env.app.version,
    CANVAS_APP_DESCRIPTION: env.app.description,
    CANVAS_APP_LICENSE: env.app.license,

    // Server
    CANVAS_SERVER_ROOT: env.server.paths.root,
    CANVAS_SERVER_CONFIG: env.server.paths.config,
    CANVAS_SERVER_DATA: env.server.paths.data,
    CANVAS_SERVER_EXT: env.server.paths.ext,
    CANVAS_SERVER_VAR: env.server.paths.var,

    // Server runtime
    CANVAS_SERVER_PID: env.pid,
    CANVAS_SERVER_IPC: env.ipc,

    // Developer settings
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',

    // User
    CANVAS_USER_HOME: env.user.paths.home,
    CANVAS_USER_CONFIG: env.user.paths.config,
    CANVAS_USER_INDEX: env.user.paths.index,
    CANVAS_USER_DB: env.user.paths.db,
    CANVAS_USER_CACHE: env.user.paths.cache,
    CANVAS_USER_DATA: env.user.paths.data,
    CANVAS_USER_WORKSPACES: env.user.paths.workspaces,
};

// Update .env to-be read by external server roles
generateDotenvFile(ini, env.filePath);

// Update process env vars
// Could just run require('dotenv').config()
process.title = `${pkg.productName} | v${pkg.version}`;
Object.assign(process.env, {...ini});

/**
 * Exports
 */

module.exports = env;


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

function generateDotenvFile(iniVars, filePath) {
    let iniContent = '';

    Object.keys(iniVars).forEach((key) => {
        let value = iniVars[key];
        if (typeof value === 'object') {
            value = JSON.stringify(value);
        }
        iniContent += `${key}="${value}"\n`;
    });

    fs.writeFileSync(filePath, iniContent);
}
