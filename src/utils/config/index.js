/**
 * Simple Config module for Canvas
 *
 * Module will do the following on initialization:
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
import dm from '../../managers/device/index.js';
import _ from 'lodash';
import env from '../../env.js';
import logger from '../log/index.js';

class Config {
    constructor(options = {}) {
        logger.info('Initializing Global Config module..');
        // Use environment variables with fallbacks
        this.serverConfigDir =
            options.serverConfigDir || env.CANVAS_SERVER_CONFIG || path.join(env.CANVAS_SERVER_HOME, 'config');
        this.userConfigDir = this.serverConfigDir; //options.userConfigDir || env.CANVAS_USER_CONFIG || path.join(env.CANVAS_USER_HOME, 'config');

        // Set configPriority based on server mode
        this.configPriority = options.configPriority || (env.CANVAS_SERVER_MODE === 'user' ? 'user' : 'server');

        this.versioning = options.versioning ?? false;
        this.device = dm.getCurrentDevice();
        this.stores = new Map();

        logger.debug(`Global Config module initialized with:
            - userConfigDir: ${this.userConfigDir}
            - serverConfigDir: ${this.serverConfigDir}
            - configPriority: ${this.configPriority}
            - versioning: ${this.versioning}
            - device ID: ${this.device.id} (${this.device.os.platform})`);
    }

    findFile(files) {
        for (const file of files) {
            if (fs.existsSync(file)) {
                logger.debug(`Config file found: ${file}`);
                return file;
            }
        }
        logger.debug('No matching config file found');
        return null;
    }

    getConfigPaths(configPath) {
        // Split path into parts (e.g., 'server.roles' -> ['server', 'roles'])
        // Get the filename from the path
        const filename = configPath.split('/').pop();
        const parts = filename.split('.');
        const baseName = parts[0];

        // Generate paths for both full config and nested config
        const generatePaths = (dir) => {
            const devicePaths = [
                // Full config paths
                path.join(dir, `${baseName}.${this.device.id}.json`),
                path.join(dir, `${baseName}.${this.device.os.platform}.json`),
                path.join(dir, `${baseName}.json`),
                // Nested config paths (if applicable)
                ...(parts.length > 1
                    ? [
                          path.join(dir, `${configPath}.${this.device.id}.json`),
                          path.join(dir, `${configPath}.${this.device.os.platform}.json`),
                          path.join(dir, `${configPath}.json`),
                      ]
                    : []),
            ];
            return devicePaths;
        };

        const userPaths = generatePaths(this.userConfigDir);
        const serverPaths = generatePaths(this.serverConfigDir);

        // Order paths based on configPriority
        const orderedPaths = this.configPriority === 'user' ? [...userPaths, ...serverPaths] : [...serverPaths, ...userPaths];

        logger.debug(`Config search paths for ${configPath}: ${JSON.stringify(orderedPaths)}`);
        return orderedPaths;
    }

    getNestedValue(obj, path) {
        return _.get(obj, path.split('.').slice(1).join('.'));
    }

    require(configName, configType = 'server') {
        const configPath =
            configType === 'server' ? path.join(this.serverConfigDir, configName) : path.join(this.userConfigDir, configName);
        if (!fs.existsSync(`${configPath}.json`)) {
            const errorMsg = `Config file ${configPath}.json not found in ${configType}/config directory. Please create one based on example-${configName}.json`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        logger.debug(`Required config loaded: ${configPath}`);
        return this.open(configPath);
    }

    open(configPath) {
        // Check cache first
        if (this.stores.has(configPath)) {
            logger.debug(`Using cached config for ${configPath}`);
            return this.stores.get(configPath);
        }

        const filesToCheck = this.getConfigPaths(configPath);
        const parts = configPath.split('.');
        const baseName = configPath;

        // First, check for specific nested config file
        if (parts.length > 1) {
            const nestedFile = this.findFile(filesToCheck.slice(3)); // Skip base config files
            if (nestedFile) {
                logger.debug(`Found nested config file: ${nestedFile}`);
                const conf = new Conf({
                    configName: baseName,
                    cwd: path.dirname(nestedFile),
                });
                this.stores.set(configPath, conf);
                return conf;
            }
        }

        // Then check for base config file and nested values
        const baseFile = this.findFile(filesToCheck);
        if (baseFile) {
            logger.debug(`Found base config file: ${baseFile}`);
            const conf = new Conf({
                configName: baseName,
                cwd: path.dirname(baseFile),
            });

            // If we're looking for a nested path, check if it exists in the base config
            if (parts.length > 1) {
                const nestedValue = this.getNestedValue(conf.store, configPath);
                if (nestedValue) {
                    logger.debug(`Found nested value in base config for: ${configPath}`);
                    // Return a new Conf instance for the nested value
                    const nestedConf = new Conf({
                        configName: baseName,
                        cwd: path.dirname(baseFile),
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
        logger.debug(`No config found for ${configPath}, creating new one in user directory`);
        const conf = new Conf({
            configName: baseName,
            cwd: this.userConfigDir,
        });

        this.stores.set(configPath, conf);
        return conf;
    }

    save(configPath, data) {
        const conf = this.stores.get(configPath) || this.open(configPath);
        logger.debug(`Saving config for ${configPath}`);
        Object.entries(data).forEach(([key, value]) => {
            conf.set(key, value);
        });
        return conf;
    }

    remove(configPath) {
        const conf = this.stores.get(configPath);
        if (conf) {
            logger.debug(`Removing config for ${configPath}`);
            conf.clear();
            this.stores.delete(configPath);
            return true;
        }
        logger.debug(`Config not found for removal: ${configPath}`);
        return false;
    }

    clear() {
        logger.debug('Clearing all config stores');
        this.stores.forEach((conf) => conf.clear());
        this.stores.clear();
        return true;
    }

    // Static factory method to create a default config instance
    static createDefault() {
        return new Config({
            userConfigDir: env.CANVAS_USER_CONFIG,
            serverConfigDir: env.CANVAS_SERVER_CONFIG,
            configPriority: env.CANVAS_SERVER_MODE === 'user' ? 'user' : 'server',
            versioning: true,
        });
    }
}

// Create and export a default instance
const defaultConfig = Config.createDefault();

export { Config, defaultConfig };
export default Config;
