/**
 * Simple Config module for Canvas
 *
 * Usage:
 * import Config from './utils/config';
 * const config = Config({
 *  userConfigDir: 'path/to/user/config',
 *  serverConfigDir: 'path/to/server/config',
 *  versioning: true,
 * });
 *
 * const myConfig = config.open('myConfig');
 *
 * The above will do the following
 * - Check if myConfig.<deviceid>.json exists in the user config dir
 * - Check if myConfig.<platform>.json exists in the user config dir
 * - Check if myConfig.json exists in the user config dir
 * - Check if myConfig.<deviceid>.json exists in the app config dir
 * - Check if myConfig.<platform>.json exists in the app config dir
 * - Check if myConfig.json exists in the app config dir
 * - If none of the above exist, create myConfig.json in the user config dir
 *
 */

// TODO: Refactor to check for deep object values too
// If server.transports would not be found in server.json, try file server.transports.json instead
// For this we need to patch the get/set functions in the Conf class

import Conf from 'conf';
import fs from 'fs';
import path from 'path';

import { getCurrentDevice } from '../../managers/device/index.mjs';
const device = getCurrentDevice();


const findFile = (files) => {
    for (const file of files) {
        if (fs.existsSync(file)) {
            return file;
        }
    }
    return null;
};

const Config = (configOpts) => {
    return {
        open: (name) => {

            const filesToCheck = (configOpts.configPriority === 'user') ?
                [
                    path.join(configOpts.userConfigDir, `${name}.${device.id}.json`),
                    path.join(configOpts.userConfigDir, `${name}.${device.os.platform}.json`),
                    path.join(configOpts.userConfigDir, `${name}.json`),
                    path.join(configOpts.serverConfigDir, `${name}.${device.id}.json`),
                    path.join(configOpts.serverConfigDir, `${name}.${device.os.platform}.json`),
                    path.join(configOpts.serverConfigDir, `${name}.json`),
                ] :
                [
                    path.join(configOpts.serverConfigDir, `${name}.${device.id}.json`),
                    path.join(configOpts.serverConfigDir, `${name}.${device.os.platform}.json`),
                    path.join(configOpts.serverConfigDir, `${name}.json`),
                    path.join(configOpts.userConfigDir, `${name}.${device.id}.json`),
                    path.join(configOpts.userConfigDir, `${name}.${device.os.platform}.json`),
                    path.join(configOpts.userConfigDir, `${name}.json`),
                ];


            const file = findFile(filesToCheck);

            if (!file) {
                const defaultFile = path.join(configOpts.userConfigDir, `${name}.json`);
                if (!fs.existsSync(configOpts.userConfigDir)) { fs.mkdirSync(configOpts.userConfigDir); }
                fs.writeFileSync(defaultFile, '{}', { encoding: 'utf-8' });
                return new Conf({ configName: name, cwd: configOpts.userConfigDir });
            } else {
                const dir = path.dirname(file);
                const baseName = path.basename(file, '.json');
                return new Conf({ configName: baseName, cwd: dir });
            }
        },
    };
};

export default Config;