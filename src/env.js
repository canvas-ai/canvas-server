/**
 * Canvas Server *single-user* env bootstrap
 */

// Utils
const path = require('path');
const fs = require('fs');
const os = require('os');
const pkg = require('../package.json');
const device = require('./managers/device').getCurrentDevice();

/**
 * System directories
 *
 * SERVER_ROOT
 * ├── src
 * ├── config
 * ├── data
 * ├── extensions
 * |   ├── roles
 * ├── user
 * ├── var
 * |   ├── log
 * |   ├── run
 */

const SERVER_ROOT = path.dirname(path.resolve(__dirname));
const SERVER_SRC = path.join(SERVER_ROOT, 'src');

// A server can be run standalone, just as a thin interface for the roleManager,
// or hosting the user context runtime
const SERVER_CONFIG = process.env['CANVAS_SERVER_CONFIG'] || path.join(SERVER_ROOT, 'config');
const SERVER_DATA = process.env['CANVAS_SERVER_DATA'] || path.join(SERVER_ROOT, 'data');
const SERVER_VAR = process.env['CANVAS_SERVER_VAR'] || path.join(SERVER_ROOT, 'var');
const SERVER_ROLES = process.env['CANVAS_SERVER_ROLES'] || path.join(SERVER_ROOT, 'extensions', 'roles');

// User directories
// For portable mode, the user home is in server ./user, otherwise it's in the system home
// User settings stored in ./config override server settings, moving your "home" folder to
// another server instance(lets say from your local ws to your NAS) should be as painless as possible
const CANVAS_USER_HOME = process.env['CANVAS_USER_HOME'] || getUserHome();
const CANVAS_USER_CONFIG = process.env['CANVAS_USER_CONFIG'] || path.join(CANVAS_USER_HOME, 'config');
const CANVAS_USER_INDEX = process.env['CANVAS_USER_INDEX'] || path.join(CANVAS_USER_HOME, 'index');
const CANVAS_USER_DB = process.env['CANVAS_USER_DB'] || path.join(CANVAS_USER_HOME, 'db');
const CANVAS_USER_CACHE = process.env['CANVAS_USER_CACHE'] || path.join(CANVAS_USER_HOME, 'cache');
const CANVAS_USER_DATA = process.env['CANVAS_USER_DATA'] || path.join(CANVAS_USER_HOME, 'data');
const CANVAS_USER_WORKSPACES = process.env['CANVAS_USER_WORKSPACES'] || path.join(CANVAS_USER_HOME, 'workspaces');

// Collect all ENV constants
const env = {
    file: path.join(SERVER_ROOT, '.env'),
    isPortable: isPortable(),

    server: {
        appName: (pkg.productName) ? pkg.productName : pkg.name,
        version: pkg.version,
        description: pkg.description,
        license: pkg.license,
        paths: {
            root: SERVER_ROOT,
            src: SERVER_SRC,
            config: SERVER_CONFIG,
            data: SERVER_DATA,
            roles: SERVER_ROLES,
            var: SERVER_VAR,
        },
    },

    // We should probably remove this part from the env
    device: {
        id: device.id,
        endianness: device.endianness,
        os: device.os,
        libc: device.os.libc, // You may have apps or roles where this will come handy(as a filter bitmap)
        network: device.network,
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

// Generate a .env ini file
const ini = {
    // Runtime
    CANVAS_RUNTIME: 'server',
    CANVAS_PORTABLE: env.isPortable,

    // Server
    CANVAS_SERVER_APP_NAME: env.server.name,
    CANVAS_SERVER_APP_VERSION: env.server.version,
    CANVAS_SERVER_APP_DESCRIPTION: env.server.description,
    CANVAS_SERVER_APP_LICENSE: env.server.license,

    CANVAS_SERVER_ROOT: env.server.paths.root,
    CANVAS_SERVER_SRC: env.server.paths.src,
    CANVAS_SERVER_CONFIG: env.server.paths.config,
    CANVAS_SERVER_DATA: env.server.paths.data,
    CANVAS_SERVER_ROLES: env.server.paths.roles,
    CANVAS_SERVER_VAR: env.server.paths.var,

    // Server runtime
    CANVAS_SERVER_PID: env.pid,
    CANVAS_SERVER_IPC: env.ipc,

    // Developer settings
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',

    CANVAS_USER_HOME: env.user.paths.home,
    CANVAS_USER_CONFIG: env.user.paths.config,
    CANVAS_USER_INDEX: env.user.paths.index,
    CANVAS_USER_DB: env.user.paths.db,
    CANVAS_USER_CACHE: env.user.paths.cache,
    CANVAS_USER_DATA: env.user.paths.data,
    CANVAS_USER_WORKSPACES: env.user.paths.workspaces,
};

// Update .env to-be read by external server roles
generateDotenvFile(ini, env.file);

// Update process env vars
// We could just run require('dotenv').config() at this point
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
