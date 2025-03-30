class Session {
    #id;
    #userId;
    #metadata;
    #isActive;
    #createdAt;
    #lastActiveAt;
    #endedAt;

    #sessionStore;
    #sessionOptions;

    constructor(sessionStore, sessionOptions = {}) {
        this.#sessionStore = sessionStore;
        this.#sessionOptions = sessionOptions;

        this.#id = sessionOptions.id;
        this.#userId = sessionOptions.userId;

        // Handle metadata - could be a string (from DB) or an object (from code)
        if (typeof sessionOptions.metadata === 'string') {
            try {
                this.#metadata = JSON.parse(sessionOptions.metadata);
            } catch (e) {
                this.#metadata = {};
            }
        } else {
            this.#metadata = sessionOptions.metadata || {};
        }

        this.#isActive = sessionOptions.isActive !== undefined ? sessionOptions.isActive : true;
        this.#createdAt = sessionOptions.createdAt ? new Date(sessionOptions.createdAt) : new Date();
        this.#lastActiveAt = sessionOptions.lastActiveAt ? new Date(sessionOptions.lastActiveAt) : new Date();
        this.#endedAt = sessionOptions.endedAt ? new Date(sessionOptions.endedAt) : null;
    }

    get id() {
        return this.#id;
    }
    get userId() {
        return this.#userId;
    }
    get metadata() {
        return this.#metadata;
    }
    get isActive() {
        return this.#isActive;
    }
    get createdAt() {
        return this.#createdAt;
    }
    get lastActiveAt() {
        return this.#lastActiveAt;
    }
    get endedAt() {
        return this.#endedAt;
    }
    get options() {
        return this.#sessionOptions;
    }

    // Convert to a plain object for storage
    toJSON() {
        return {
            id: this.#id,
            userId: this.#userId,
            metadata: JSON.stringify(this.#metadata),
            isActive: this.#isActive,
            createdAt: this.#createdAt.toISOString(),
            lastActiveAt: this.#lastActiveAt.toISOString(),
            endedAt: this.#endedAt ? this.#endedAt.toISOString() : null,
        };
    }

    // For console.log and JSON.stringify
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return {
            id: this.#id,
            userId: this.#userId,
            metadata: this.#metadata,
            isActive: this.#isActive,
            createdAt: this.#createdAt,
            lastActiveAt: this.#lastActiveAt,
            endedAt: this.#endedAt,
        };
    }

    async save() {
        try {
            await this.#sessionStore.put(this.#id, this.toJSON());
            return true;
        } catch (error) {
            console.error('Error saving session:', error);
            throw error;
        }
    }

    async delete() {
        try {
            await this.#sessionStore.remove(this.#id);
            return true;
        } catch (error) {
            console.error('Error deleting session:', error);
            throw error;
        }
    }

    touch() {
        this.#lastActiveAt = new Date();
    }

    end() {
        this.#endedAt = new Date();
        this.#isActive = false;
    }
}

export default Session;
