import db from './storage.js';
import crypto from 'crypto';

class TokenService {
    constructor() {
        this.tokens = db;
    }

    async createToken(userId, name) {
        const id = crypto.randomUUID();
        const token = crypto.randomBytes(32).toString('hex');
        const tokenData = {
            id,
            userId,
            name,
            token,
            createdAt: new Date().toISOString(),
            lastUsedAt: null
        };
        await this.tokens.setItem(`token:${id}`, tokenData);
        return tokenData;
    }

    async getToken(token) {
        const keys = await this.tokens.getKeys('token:');
        for (const key of keys) {
            const tokenData = await this.tokens.getItem(key);
            if (tokenData.token === token) {
                return tokenData;
            }
        }
        return null;
    }

    async getTokensByUserId(userId) {
        const keys = await this.tokens.getKeys('token:');
        const tokens = [];
        for (const key of keys) {
            const tokenData = await this.tokens.getItem(key);
            if (tokenData.userId === userId) {
                tokens.push(tokenData);
            }
        }
        return tokens;
    }

    async updateTokenLastUsed(tokenId) {
        const token = await this.tokens.getItem(`token:${tokenId}`);
        if (!token) return null;

        const updatedToken = {
            ...token,
            lastUsedAt: new Date().toISOString()
        };
        await this.tokens.setItem(`token:${tokenId}`, updatedToken);
        return updatedToken;
    }

    async deleteToken(tokenId) {
        await this.tokens.removeItem(`token:${tokenId}`);
    }
}

export default new TokenService();
