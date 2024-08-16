'use strict';

// Utils
const os = require('os');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const debug = require('debug')('canvas:db:backend:pouchdb');
const EventEmitter = require('eventemitter2');

class Db extends EventEmitter {

    constructor(options = {}) {
        super();
    }

}

module.exports = Db;
