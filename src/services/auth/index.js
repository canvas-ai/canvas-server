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
    const userStore = await UserStore();

    const existingUser = await userStore.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await User.hashPassword(password);
    const u = new User(email, hashedPassword); // we generate the user id here for now
    await userStore.create(u);
    
    this.emit('user:created', u);
    
    const token = this.sessionService.generateToken(u);
    return { user: u, token };
  }

  async login(email, password) {
    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }
    const userStore = await UserStore();

    const user = await userStore.findByEmail(email);
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