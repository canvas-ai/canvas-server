import debugMessage from 'debug';
import WorkspaceManager from '../../managers/workspace/index.js';
const debug = debugMessage('canvas:events:user');

class UserEventHandler {
  constructor(config, services = {}) {
    this.config = config;
    this.services = services;
    this.setupHandlers();
  }

  setupHandlers() {
    if (this.services.auth) {
      this.services.auth.on('user:created', this.handleUserCreated.bind(this));
    }
  }

  async handleUserCreated(user) {
    debug('New user created:', user.email);

    try {
      if (!user.email) {
        throw new Error('User email is required');
      }

      // Create default workspace for new user using their email as ID
      const workspaceManager = new WorkspaceManager({
        rootPath: this.config.dataPath
      });

      // This will create /data/multiverse/user@email.tld/universe
      await workspaceManager.createWorkspace(user.email);

      debug(`Created default workspace for user: ${user.email}`);
    } catch (error) {
      console.error('Error handling user creation:', error);
      throw error;
    }
  }
}

export default UserEventHandler;