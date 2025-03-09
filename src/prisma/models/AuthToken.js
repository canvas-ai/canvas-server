import { uuid } from '@/utils/common.js';
import BaseModel from './Base.js';
import crypto from 'crypto';

class AuthToken extends BaseModel {
    static fillable = ['id', 'userId', 'token', 'name', 'lastUsedAt', 'expiresAt', 'revoked'];
    static hidden = ['token'];
    static connections = ['user'];
    static modelName = 'authToken';

    // Generate a new token
    static async generateToken(userId, name = 'API Token', expiresInDays = null) {
        // Generate a secure random token
        const tokenValue = crypto.randomBytes(32).toString('hex');

        // Calculate expiration date if provided
        let expiresAt = null;
        if (expiresInDays) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        }

        // Create the token in the database
        const token = await this.create({
            userId,
            token: tokenValue,
            name,
            expiresAt,
        });

        // Return both the model and the raw token value
        return {
            token: token,
            tokenValue: tokenValue
        };
    }

    // Verify a token
    static async verifyToken(tokenValue) {
        const token = await this.prisma.authToken.findUnique({
            where: { token: tokenValue },
            include: { user: true }
        });

        if (!token) {
            return null;
        }

        // Check if token is revoked
        if (token.revoked) {
            return null;
        }

        // Check if token is expired
        if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
            return null;
        }

        // Update last used timestamp
        await this.prisma.authToken.update({
            where: { id: token.id },
            data: { lastUsedAt: new Date() }
        });

        return {
            token: new this(token),
            user: token.user
        };
    }

    // Revoke a token
    async revoke() {
        await this.constructor.prisma.authToken.update({
            where: { id: this.id },
            data: { revoked: true }
        });

        this.revoked = true;
        return this;
    }

    // Check if token is valid
    isValid() {
        if (this.revoked) {
            return false;
        }

        if (this.expiresAt && new Date(this.expiresAt) < new Date()) {
            return false;
        }

        return true;
    }
}

export default AuthToken;
