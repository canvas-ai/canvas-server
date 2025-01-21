import bcrypt from 'bcryptjs';
import { genUUID } from '../../extensions/transports/net-ipc/lib/utils.js';

class User {
  constructor(email, password, id = null) {
    this.id = id || this._generateUniqueId();
    this.email = email;
    this.password = password;
  }

  _generateUniqueId() {
    return genUUID();
  }

  static async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }
}

export default User;