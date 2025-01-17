import validator from 'validator';
import User from '../../models/User.js';
import UserStore from '../../managers/user/store/index.js';
import SessionService from './lib/SessionService.js';
import EventEmitter from 'eventemitter2';
import { workspaceManager } from '../../Server.js';
import UserEventHandler from '../events/UserEventHandler.js';

class AuthService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.userStore = UserStore();
    this.sessionService = new SessionService(config);
    this.userEventHandler = new UserEventHandler({
      auth: this,
      workspace: workspaceManager
    });
  }

  async register(email, password) {
    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }

    const existingUser = await this.userStore.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await User.hashPassword(password);
    const user = await this.userStore.create(new User(email, hashedPassword));
    
    this.emit('user:created', user);
    
    const token = this.sessionService.generateToken(user);
    return { user, token };
  }

  async login(email, password) {
    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }

    const user = await this.userStore.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    const userModel = new User(user.email, user.password, user.id);
    const isValid = await userModel.comparePassword(password);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    const token = this.sessionService.generateToken(userModel);
    return { user: userModel, token };
  }

  logout(res) {
    this.sessionService.clearCookie(res);
  }

  getAuthMiddleware() {
    return this.sessionService.getAuthMiddleware();
  }
}

export default AuthService;