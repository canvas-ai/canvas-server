import { uuid } from '@/utils/common.js';
import BaseModel from './Base.js';
import bcrypt from 'bcryptjs';

class User extends BaseModel {
    static fillable = ['id', 'email', 'password', 'homePath'];
    static hidden = [];
    static connections = ['sessions'];
    static modelName = 'user';

    async comparePassword(candidatePassword) {
        return bcrypt.compare(candidatePassword, this.password);
    }

    // Additional static methods specific to User
    static async findByEmail(email) {
        const result = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: this.buildSelect(),
        });
        return result ? new this(result) : null;
    }

    static async hashPassword(password) {
        return bcrypt.hash(password, 10);
    }
}

export default User;
