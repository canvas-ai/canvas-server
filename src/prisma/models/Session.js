import BaseModel from './Base.js';

class Session extends BaseModel {
    static fillable = ['id', 'name', 'initializer'];
    static hidden = [];
    static connections = ['user'];
    static modelName = 'session';

    constructor(data = {}) {
        super(data);
    }

    static async findByUserId(userId) {
        return await this.findMany({ userId });
    }

    static async findByUserIdAndName(userId_name) {
        return await this.findUnique({
            userId_name,
        });
    }
}

export default Session;