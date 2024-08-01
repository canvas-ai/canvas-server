const fsDriver = require('./driver/fs');
const lokiDriver = require('./driver/lokijs');

class JsonIndex {

    constructor(configRootPath, driver = 'fs') {
        this.configRootPath = configRootPath;
        this.driver = driver;
        this.index = null;
    }

    async init() {
        if (this.driver === 'fs') {
            this.index = new fsDriver(this.configRootPath);
        } else if (this.driver === 'lokijs') {
            this.index = new lokiDriver(this.configRootPath);
        }

        await this.index.init();
    }

    create(name) {
        return this.index.create(name);
    }

    get(name) {
        return this.index.get(name);
    }

    // Expose native LokiJS database object
    get db() {
        if (this.driver !== 'lokijs') {
            throw new Error('Database object is only available when using LokiJS driver.');
        }
        return this.index.db;
    }

}

module.exports = JsonIndex;
