// Utils
import EventEmitter from 'eventemitter2';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('user-manager');

// Includes
import env from '../../env.js';
import User from './lib/User.js';

/**
 * Constants
 */

const USER_TYPES = ['user', 'admin'];
const USER_CONFIG_FILENAME = 'user.json';
const USER_STATUS = ['active', 'inactive', 'deleted'];

/**
 * User Manager
 * Manages user lifecycle and persistence
 */

class UserManager extends EventEmitter {

    #rootPath;
    #configPath;

    #index;
    #users = new Map();

    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        this.#rootPath = options.rootPath || env.CANVAS_USER_HOME;
        this.#configPath = path.join(this.#rootPath, 'Config');

        this.#index = new Map();
        this.#users = new Map();

    }
}

export default UserManager;
