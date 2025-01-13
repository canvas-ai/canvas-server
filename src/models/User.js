import bcrypt from 'bcryptjs';

class User {
  constructor(email, password, id = null) {
    this.id = id || this._generateUniqueId();
    this.email = email;
    this.password = password;
  }

  _generateUniqueId() {
    const timestamp = Date.now().toString(36);
    const randomness = Math.random().toString(36).substr(2, 5);
    const userSpecific = this.email ? this.email.substr(0, 3) : 'xxx';
    return `${timestamp}-${userSpecific}-${randomness}`;
  }

  static async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }
}

export default User;