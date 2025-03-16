import BaseModule from '../lib/BaseModule.js';

class RolesModule extends BaseModule {
    getEndpoints() {
        return {
            base: '/roles',
        };
    }
}

export default RolesModule;
