import EventEmitter from 'eventemitter2';
import debugInstance from 'debug';
const debug = debugInstance('canvas:app-manager');

/**
 * App manager
 */

class AppManager extends EventEmitter {

    #index;

    constructor(options = {}) {
        debug('Initializing Canvas App Manager');
        super();
    }

}

export default AppManager;
