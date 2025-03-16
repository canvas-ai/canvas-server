import BaseModule from '../lib/BaseModule.js';

class NotesModule extends BaseModule {
    getEndpoints() {
        return {
            base: '/documents',
        };
    }

    // Override add to handle the specific notes format
    async add(args = [], opts = {}, data = null) {
        const payload = {
            title: opts.title || 'Untitled Note',
            content: data || args.join(' '),
            tags: opts.tag ? (Array.isArray(opts.tag) ? opts.tag : [opts.tag]) : [],
        };

        const response = await this.api.post(this.endpoints.base, payload);
        return this.handleResponse(response);
    }
}

export default NotesModule;
