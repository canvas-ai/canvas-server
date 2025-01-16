import jwt from 'jsonwebtoken';
import passport from 'passport';
import configurePassport from '../../../utils/passport.js';

class SessionService {
  constructor(config) {
    this.config = config;
    this.init();
  }

  init() {
    configurePassport(this.config.jwtSecret);
  }

  generateToken(user) {
    return jwt.sign({ id: user.id }, this.config.jwtSecret, {
      expiresIn: this.config.jwtLifetime
    });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.config.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  getAuthMiddleware() {
    return passport.authenticate('jwt', { session: false });
  }

  setCookie(res, token) {
    res.cookie('token', token, { httpOnly: true });
  }

  clearCookie(res) {
    res.clearCookie('token');
  }
}

export default SessionService;