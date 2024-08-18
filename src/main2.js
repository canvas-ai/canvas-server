const IndexD = require("./core/indexd");
const RoleManager = require("./managers/role");



class Canvas {


    constructor(options) {


        this.index = new IndexD();
        this.storage = new Stored();

        this.services = new ServiceManager();
        this.transports = new TransportManager();

        this.devices = new DeviceManager();
        this.roles = new RoleManager();
        this.agents = new AgentManager();


        this.workspaces = new WorkspaceManager();

    }

}