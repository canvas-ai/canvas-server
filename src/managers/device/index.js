import Desktop from './lib/Desktop.js';

class DeviceManager {

    constructor() {}

    static getCurrentDevice() {
        return new Desktop();
    }

}

export default DeviceManager;
export const getCurrentDevice = DeviceManager.getCurrentDevice;
