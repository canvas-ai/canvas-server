


class Workspace {

    constructor(opts = {}) {
        this.id = opts.id || 'universe';
        this.name = opts.name || 'Universe';
        this.description = opts.description || 'The Universe';
        this.baseUrl = opts.baseUrl || '/';
        this.color = opts.color || '#FFFFFF';
    }
}

module.exports = Workspace;