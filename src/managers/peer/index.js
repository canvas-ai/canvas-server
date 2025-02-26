'use strict';

import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('peer-manager');
import EventEmitter from 'eventemitter2';
import Peer from './lib/Peer.js';

/**
 * Peer manager
 */

class PeerManager extends EventEmitter {
    constructor(options = {}) {
        super();
    }
}

// Create a singleton instance
const instance = new PeerManager();

// Named export for the class
export { PeerManager };

// Default export for the singleton
export default instance;
