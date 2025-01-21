import debug from 'debug';

const log = debug('canvas:session-manager:session');

class Session {

    constructor(name, sessionOptions = {}, sessionMap = new Map()) {
        if (!name) {throw new Error('Session name required');}
        this.name = name;

        Object.keys(sessionOptions).forEach(key => {
            this[key] = sessionOptions[key];
        });

        log(`Session options: ${JSON.stringify(sessionOptions, null, 2)}`);

        this.connectedDevices = sessionMap; // Map of connected devices for this session
    }

    update(options) {
        for (let option in options) {
            this[option] = options[option];
        }
        return this;
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            name: this.name,
            initializer: this.initializer
        };
    }

}

export default Session;
