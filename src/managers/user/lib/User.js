'use strict';

import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('user');
import EventEmitter from 'eventemitter2';

class User extends EventEmitter {

    #id;
    #email;
    #password;
    #homePath;

    #workspaces;
    #sessions;
    #contexts;
    #devices;
    #roles;
    //#identities;


    constructor(options = {}) {
        super();
    }

    async initialize() { }

}

export default User;
