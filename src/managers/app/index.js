import EventEmitter from 'eventemitter2';
import debug from 'debug';

/**
 * App manager
 */

class AppManager extends EventEmitter {

    #index;

    constructor(options = {}) {
        debug('Initializing Canvas App Manager');
        super();

        // Validate options
        if (!options.index) { throw new Error('Index not provided'); }
        this.#index = options.index;
    }

}

export default AppManager;
