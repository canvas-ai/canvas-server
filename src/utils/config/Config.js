/**
 * Simple Config module for Canvas
 *
 * The above will do the following
 * - Check if myConfig.<deviceid>.json exists in the user config dir
 * - Check if myConfig.<platform>.json exists in the user config dir
 * - Check if myConfig.json exists in the user config dir
 * - Check if myConfig.<deviceid>.json exists in the app config dir
 * - Check if myConfig.<platform>.json exists in the app config dir
 * - Check if myConfig.json exists in the app config dir
 * - If none of the above exist, create myConfig.json in the user config dir
 * - It will also check for nested config files (server.roles.json, server.roles.<deviceid>.json, etc.)
 *
 */

// src/utils/config/Config.js
import Conf from 'conf';
import fs from 'fs';
import path from 'path';
import { getCurrentDevice } from '../../managers/device/index.mjs';
import _ from 'lodash';

class Config {

    constructor({ userConfigDir, serverConfigDir, configPriority = 'user', versioning = true }) {
        this.userConfigDir = userConfigDir;
        this.serverConfigDir = serverConfigDir;
        this.configPriority = configPriority;
        this.versioning = versioning;
        this.device = getCurrentDevice();
        this.stores = new Map();
    }

    findFile(files) {
        for (const file of files) {
            if (fs.existsSync(file)) {
                return file;
            }
        }
        return null;
    }

    getConfigPaths(configPath) {
        // Split path into parts (e.g., 'server.roles' -> ['server', 'roles'])
        const parts = configPath.split('.');
        const baseName = parts[0];

        // Generate paths for both full config and nested config
        const generatePaths = (dir) => {
            const devicePaths = [
                // Full config paths
                path.join(dir, `${baseName}.${this.device.id}.json`),
                path.join(dir, `${baseName}.${this.device.os.platform}.json`),
                path.join(dir, `${baseName}.json`),
                // Nested config paths (if applicable)
                ...(parts.length > 1 ? [
                    path.join(dir, `${configPath}.${this.device.id}.json`),
                    path.join(dir, `${configPath}.${this.device.os.platform}.json`),
                    path.join(dir, `${configPath}.json`)
                ] : [])
            ];
            return devicePaths;
        };

        const userPaths = generatePaths(this.userConfigDir);
        const serverPaths = generatePaths(this.serverConfigDir);

        return this.configPriority === 'user'
            ? [...userPaths, ...serverPaths]
            : [...serverPaths, ...userPaths];
    }

    getNestedValue(obj, path) {
        return _.get(obj, path.split('.').slice(1).join('.'));
    }

    open(configPath) {
        // Check cache first
        if (this.stores.has(configPath)) {
            return this.stores.get(configPath);
        }

        const filesToCheck = this.getConfigPaths(configPath);
        const parts = configPath.split('.');
        const baseName = configPath;

        // First, check for specific nested config file
        if (parts.length > 1) {
            const nestedFile = this.findFile(filesToCheck.slice(3)); // Skip base config files
            if (nestedFile) {
                const conf = new Conf({
                    configName: baseName,
                    cwd: path.dirname(nestedFile)
                });
                this.stores.set(configPath, conf);
                return conf;
            }
        }

        // Then check for base config file and nested values
        const baseFile = this.findFile(filesToCheck);
        if (baseFile) {
            const conf = new Conf({
                configName: baseName,
                cwd: path.dirname(baseFile)
            });

            // If we're looking for a nested path, check if it exists in the base config
            if (parts.length > 1) {
                const nestedValue = this.getNestedValue(conf.store, configPath);
                if (nestedValue) {
                    // Return a new Conf instance for the nested value
                    const nestedConf = new Conf({
                        configName: baseName,
                        cwd: path.dirname(baseFile)
                    });
                    nestedConf.store = nestedValue;
                    this.stores.set(configPath, nestedConf);
                    return nestedConf;
                }
            }

            // If it's a base path or we couldn't find the nested value
            this.stores.set(configPath, conf);
            return conf;
        }

        // If nothing found, create new config in user directory
        const conf = new Conf({
            configName: baseName,
            cwd: this.userConfigDir
        });

        this.stores.set(configPath, conf);
        return conf;
    }

    save(configPath, data) {
        const conf = this.stores.get(configPath) || this.open(configPath);
        Object.entries(data).forEach(([key, value]) => {
            conf.set(key, value);
        });
        return conf;
    }

    remove(configPath) {
        const conf = this.stores.get(configPath);
        if (conf) {
            conf.clear();
            this.stores.delete(configPath);
            return true;
        }
        return false;
    }

    clear() {
        this.stores.forEach(conf => conf.clear());
        this.stores.clear();
        return true;
    }
}

export default Config;


// Usage examples:
/*
const config = new Config({
    userConfigDir: '/path/to/user/config',
    serverConfigDir: '/path/to/server/config'
});

const serverConfig = config.open('server');
const rolesConfig = config.open('server.roles');
const restTransport = config.open('server.transports.rest');

// Lookup priority for 'server.roles':
// 1. server.roles.<deviceid>.json
// 2. server.roles.<platform>.json
// 3. server.roles.json
// 4. server.<deviceid>.json (looking for roles section)
// 5. server.<platform>.json (looking for roles section)
// 6. server.json (looking for roles section)
// If none found, creates server.roles.json

// Using nested configs
rolesConfig.set('canvas.minion', {
    driver: 'docker',
    driverOptions: { host: 'localhost' }
});

// Platform-specific storage paths
const storageConfig = config.open('storage');
// Will look for storage.windows.json on Windows
// Will look for storage.<deviceid>.json for device-specific paths
// Falls back to storage.json for common paths
*/
