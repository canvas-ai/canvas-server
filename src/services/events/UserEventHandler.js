import debugMessage from 'debug';
import { uuid12 } from '../../../extensions/transports/net-ipc/lib/utils.js';
const debug = debugMessage('canvas:events:user');

class UserEventHandler {
  constructor(services = {}) {
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
      // Handle any post-user creation tasks here
      // For example:
      // - Send welcome email?
      // - Notify admin?
      // - etc

      // Create default workspace

      
      if (this.services.workspace) {
        const defaultWorkspace = await this.services.workspace.createWorkspace(
          `${user.id}`,
          uuid12(),
          { name: 'Universe', description: 'Default workspace', baseUrl: '/', color: '#fff' }
        );
        debug('Created default workspace for user:', defaultWorkspace.id);
      }
      
    } catch (error) {
      debug('Error handling user creation:', error);
      // You might want to emit an error event here
      if (this.services.auth) {
        this.services.auth.emit('user:created:error', { user, error });
      }
    }
  }
}

export default UserEventHandler;