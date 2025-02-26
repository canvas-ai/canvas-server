import validator from 'validator';
import SessionService from './lib/SessionService.js';
import EventEmitter from 'eventemitter2';
import UserEventHandler from '../events/UserEventHandler.js';
import User from '@/prisma/models/User.js';

/**
 * Auth Service
 */

// TODO: Refactor

class AuthService extends EventEmitter {
  constructor(config, { workspaceManager }) {
    super();
    this.config = config;
    this.sessionService = new SessionService(config);
    this.workspaceManager = workspaceManager;
    this.userEventHandler = new UserEventHandler({
      auth: this,
      workspace: workspaceManager
    });
  }

  async register(email, password) {
    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await User.hashPassword(password);
    const user = await User.create({
      email,
      password: hashedPassword
    });

    this.emit('user:created', user);

    const token = this.sessionService.generateToken(user);
    return { user, token };
  }

  async login(email, password) {
    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }

    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    delete user.password;

    const token = this.sessionService.generateToken(user);
    return { user, token };
  }

  logout(res) {
    this.sessionService.clearCookie(res);
  }

  getAuthMiddleware() {
    return this.sessionService.getAuthMiddleware();
  }
}

export default AuthService;
