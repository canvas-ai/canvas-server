import Desktop from './types/Desktop.mjs';

class DeviceManager {

    constructor() {}

    static getCurrentDevice() {
        return new Desktop();
    }

}

export default DeviceManager;
export const getCurrentDevice = DeviceManager.getCurrentDevice;
