export default class Workspace {
    constructor(opts = {}) {
        this.id = opts.id || 'universe';
        this.name = opts.name || opts.id || 'Universe';
        this.description = opts.description || 'And then, there was ..geometry';
        this.baseUrl = opts.baseUrl || '/';
        this.color = opts.color || '#FFFFFF';
    }
}
