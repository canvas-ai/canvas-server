import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('app-manager');
import EventEmitter from 'eventemitter2';
import App from './lib/App.js';
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
