import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('device-manager');
import EventEmitter from 'eventemitter2';
import GenericDevice from './lib/Generic.js';

class DeviceManager extends EventEmitter {

    constructor() {
        super();
    }

    static getCurrentDevice() {
        return new GenericDevice();
    }

    getCurrentDevice() {
        return DeviceManager.getCurrentDevice();
    }

}

// Named exports
export { DeviceManager };
export const getCurrentDevice = DeviceManager.getCurrentDevice;

// Default export
export default getCurrentDevice;
