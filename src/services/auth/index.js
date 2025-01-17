import User from '../../models/User.js';
import UserStore from '../../managers/user/store/index.js';
import SessionService from './lib/SessionService.js';

class AuthService {
  constructor(config) {
    this.config = config;
    this.userStore = UserStore();
    this.sessionService = new SessionService(config);
  }

  async register(email, password) {
    const existingUser = await this.userStore.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await User.hashPassword(password);
    const user = await this.userStore.create(new User(email, hashedPassword));
    
    const token = this.sessionService.generateToken(user);
    return { user, token };
  }

  async login(email, password) {
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