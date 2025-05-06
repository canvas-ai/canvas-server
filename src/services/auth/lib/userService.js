import db from './storage.js';

class UserService {
    constructor() {
        this.users = db;
    }

    async createUser(user) {
        const id = crypto.randomUUID();
        const userData = {
            id,
            ...user,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await this.users.setItem(`user:${id}`, userData);
        return userData;
    }

    async getUserByEmail(email) {
        const keys = await this.users.getKeys('user:');
        for (const key of keys) {
            const user = await this.users.getItem(key);
            if (user.email === email) {
                return user;
            }
        }
        return null;
    }

    async getUserById(id) {
        return await this.users.getItem(`user:${id}`);
    }

    async updateUser(id, updates) {
        const user = await this.getUserById(id);
        if (!user) return null;

        const updatedUser = {
            ...user,
            ...updates,
            updatedAt: new Date().toISOString()
        };
        await this.users.setItem(`user:${id}`, updatedUser);
        return updatedUser;
    }

    async deleteUser(id) {
        await this.users.removeItem(`user:${id}`);
    }
}

export default new UserService();
