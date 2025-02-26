'use strict';

import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('context-url');

/**
 * Context URL
 *
 * Handles parsing and formatting context URLs
 * Format: sessionId@workspaceId://path
 * Example: my-laptop@universe://work/acme/devops/jira-1234
 */
class Url {
    #raw;
    #sessionId;
    #workspaceId;
    #path;
    #valid = false;

    constructor(url) {
        this.#raw = url;
        this.#parse(url);
    }

    /**
     * Parse a context URL
     * @param {string} url - Context URL
     */
    #parse(url) {
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL: URL must be a string');
        }

        // Parse URL format: sessionId@workspaceId://path
        const urlRegex = /^([^@]+)@([^:]+):\/\/(.*)$/;
        const match = url.match(urlRegex);

        if (!match) {
            throw new Error('Invalid URL format. Expected: sessionId@workspaceId://path');
        }

        this.#sessionId = match[1];
        this.#workspaceId = match[2];
        this.#path = match[3] || '/';

        // Normalize path
        if (!this.#path.startsWith('/')) {
            this.#path = '/' + this.#path;
        }

        this.#valid = true;
    }

    /**
     * Get the raw URL
     * @returns {string} - Raw URL
     */
    get raw() {
        return this.#raw;
    }

    /**
     * Get the session ID
     * @returns {string} - Session ID
     */
    get sessionId() {
        return this.#sessionId;
    }

    /**
     * Get the workspace ID
     * @returns {string} - Workspace ID
     */
    get workspaceId() {
        return this.#workspaceId;
    }

    /**
     * Get the path
     * @returns {string} - Path
     */
    get path() {
        return this.#path;
    }

    /**
     * Check if the URL is valid
     * @returns {boolean} - True if valid
     */
    get isValid() {
        return this.#valid;
    }

    /**
     * Format the URL
     * @returns {string} - Formatted URL
     */
    toString() {
        if (!this.#valid) {
            throw new Error('Cannot format invalid URL');
        }

        return `${this.#sessionId}@${this.#workspaceId}://${this.#path.replace(/^\//, '')}`;
    }

    /**
     * Create a new URL with a different path
     * @param {string} path - New path
     * @returns {Url} - New URL instance
     */
    withPath(path) {
        if (!this.#valid) {
            throw new Error('Cannot modify invalid URL');
        }

        return new Url(`${this.#sessionId}@${this.#workspaceId}://${path}`);
    }

    /**
     * Create a new URL with a different session ID
     * @param {string} sessionId - New session ID
     * @returns {Url} - New URL instance
     */
    withSessionId(sessionId) {
        if (!this.#valid) {
            throw new Error('Cannot modify invalid URL');
        }

        return new Url(`${sessionId}@${this.#workspaceId}://${this.#path}`);
    }

    /**
     * Create a new URL with a different workspace ID
     * @param {string} workspaceId - New workspace ID
     * @returns {Url} - New URL instance
     */
    withWorkspaceId(workspaceId) {
        if (!this.#valid) {
            throw new Error('Cannot modify invalid URL');
        }

        return new Url(`${this.#sessionId}@${workspaceId}://${this.#path}`);
    }
}

export default Url;
