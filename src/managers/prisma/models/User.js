import { genUUID } from '../../../../extensions/transports/net-ipc/lib/utils.js';
import BaseModel from './Base.js';
import bcrypt from 'bcryptjs';

class User extends BaseModel {
  static fillable = ['id', 'email', 'password'];
  static hidden = [];
  static connections = ['sessions'];
  static modelName = 'user';

  // Instance methods
  _generateUniqueId() {
    return genUUID();
  }

  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // Additional static methods specific to User
  static async findByEmail(email) {
    const result = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: this.buildSelect()
    });
    return result ? new this(result) : null;
  }

  static async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }
}

export default User;