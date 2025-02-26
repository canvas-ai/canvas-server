
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('user');
import EventEmitter from 'eventemitter2';

class User extends EventEmitter {

    constructor(options = {}) {
        super();
    }

    async initialize() { }

}

export default User;
