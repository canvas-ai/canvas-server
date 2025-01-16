import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import UserStore from '../managers/user/store/index.js';
import User from '../models/User.js';

const cookieExtractor = (req) => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies['token'];
  }
  return token;
};

export default function configurePassport(jwtSecret) {
  // Local Strategy
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  }, async (email, password, done) => {
    try {
      const userStore = UserStore();
      const user = await userStore.findByEmail(email);
      if (!user) {
        return done(null, false, { message: 'Incorrect email.' });
      }

      const u = new User(user.email, user.password, user.id);

      const isValid = await u.comparePassword(password);
      if (!isValid) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      return done(null, u);
    } catch (error) {
      return done(error);
    }
  }));

  // JWT Strategy
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromExtractors([
      ExtractJwt.fromAuthHeaderAsBearerToken(),
      cookieExtractor
    ]),
    secretOrKey: jwtSecret
  }, async (payload, done) => {
    try {
      const userStore = UserStore();
      const user = await userStore.findById(payload.id);
      if (!user) {
        return done(null, false);
      }
      return done(null, new User(user.email, user.password, payload.id));
    } catch (error) {
      return done(error);
    }
  }));
}