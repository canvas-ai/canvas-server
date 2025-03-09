import BaseModel from './Base.js';

class Session extends BaseModel {
    static fillable = [
        'id',
        'userId',
        'metadata',
        'createdAt',
        'lastActiveAt',
        'endedAt',
        'isActive'
    ];
    static hidden = [];
    static connections = ['user'];
    static modelName = 'session';

    constructor(data = {}) {
        super(data);
    }

    /**
     * Find sessions by user ID
     * @param {string} userId - User ID
     * @returns {Promise<Array>} - Array of sessions
     */
    static async findByUserId(userId) {
        return await this.findMany({ userId });
    }

    /**
     * Find active sessions
     * @returns {Promise<Array>} - Array of active sessions
     */
    static async findActive() {
        return await this.findMany({ isActive: true });
    }

    /**
     * Parse metadata if it's stored as a string
     * @returns {Object} - Parsed metadata
     */
    getMetadata() {
        if (typeof this.metadata === 'string') {
            try {
                return JSON.parse(this.metadata);
            } catch (error) {
                return {};
            }
        }
        return this.metadata || {};
    }
}

export default Session;