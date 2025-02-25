export default class Canvas {

    constructor(options = {}) {
        this.id = options.id;
        this.name = options.name;
        this.description = options.description;
        this.createdAt = options.createdAt;
        this.updatedAt = options.updatedAt;

        this.context = options.context;
        this.features = options.features;
        this.filters = options.filters;

        this.users = options.users;
        this.agents = options.agents;
        this.minions = options.minions;

        this.messages = options.messages; // Conversation log
        this.log = options.log;

        this.ui = options.ui; // Layout data
    }

    setContext(context) {
        this.context = context;
    }

    setFeatures(features) {
        this.features = features;
    }

}
