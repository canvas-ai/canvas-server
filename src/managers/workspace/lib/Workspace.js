import debugMessage from 'debug';
const debug = debugMessage('canvas:context:workspace');

// sesssionName@workspaceName://contextUrl where context consists of workspaceName://contextUrl

export default class Workspace {

    constructor(id, context, opts = {}) {
        if (!id) { throw new Error('Workspace ID required'); }
        if (typeof id !== 'string') { throw new Error('Workspace ID must be a string'); }
        this.id = id;
        this.name = opts.name || id;
        this.description = opts.description || 'Canvas Workspace';
        this.baseUrl = opts.baseUrl || '/';
        this.color = opts.color || '#FFF';
    }

    #lockLayers() {
        if (this.baseUrl === '/') { return; }
        debug(`Locking layers "${this.baseUrl}" for workspace ${this.id}`);
    }

    #unlockLayers() {
        if (this.baseUrl === '/') { return; }
        debug(`Unlocking layers "${this.baseUrl}" for workspace ${this.id}`);
    }
}
