import Desktop from './types/Desktop';

class DeviceManager {

    constructor() {}
  
    static getCurrentDevice() {
        return new Desktop();
    }
  
}
  
export default DeviceManager;
