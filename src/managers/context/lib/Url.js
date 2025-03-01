'use strict';

import { createDebug } from '@/utils/log/index.js';
const debug = createDebug('context-url');

/**
 * Context URL
 *
 * Handles parsing and formatting context URLs
 * Formats supported:
 * 1. sessionId@workspaceId://path - Full format with session and workspace
 * 2. workspaceId://path - Format with only workspace
 * 3. /path or path - Simple path format (uses current workspace)
 *
 * Note: The workspaceId is a UUID and should not contain @ symbols.
 * The sessionId is also a UUID.
 *
 * Examples:
 * - 550e8400-e29b-41d4-a716-446655440000@123e4567-e89b-12d3-a456-426614174000://work/acme/devops/jira-1234
 * - 123e4567-e89b-12d3-a456-426614174000://work/acme/devops/jira-1234
 * - /work/acme/devops/jira-1234
 * - work/acme/devops/jira-1234
 */
class Url {
    #raw;
    #sessionId;
    #workspaceId;
    #path;
    #valid = false;
    #format = 'simple'; // 'full', 'workspace', 'simple'

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

        // Try to parse as full format: sessionId@workspaceId://path
        const fullFormatRegex = /^([^@]+)@([^:]+):\/\/(.*)$/;
        const fullMatch = url.match(fullFormatRegex);

        if (fullMatch) {
            this.#sessionId = fullMatch[1];
            this.#workspaceId = fullMatch[2];
            this.#path = fullMatch[3] || '/';
            this.#format = 'full';
        } else {
            // Try to parse as workspace format: workspaceId://path
            const workspaceFormatRegex = /^([^:]+):\/\/(.*)$/;
            const workspaceMatch = url.match(workspaceFormatRegex);

            if (workspaceMatch) {
                this.#workspaceId = workspaceMatch[1];
                this.#path = workspaceMatch[2] || '/';
                this.#format = 'workspace';
            } else {
                // Simple path format: /path or path
                this.#path = url;
                this.#format = 'simple';
            }
        }

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
     * @returns {string|null} - Session ID or null if not present
     */
    get sessionId() {
        return this.#sessionId || null;
    }

    /**
     * Get the workspace ID
     * @returns {string|null} - Workspace ID or null if not present
     */
    get workspaceId() {
        return this.#workspaceId || null;
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
     * Get the URL format
     * @returns {string} - 'full', 'workspace', or 'simple'
     */
    get format() {
        return this.#format;
    }

    /**
     * Check if the URL has a session ID
     * @returns {boolean} - True if the URL has a session ID
     */
    get hasSessionId() {
        return !!this.#sessionId;
    }

    /**
     * Check if the URL has a workspace ID
     * @returns {boolean} - True if the URL has a workspace ID
     */
    get hasWorkspaceId() {
        return !!this.#workspaceId;
    }

    /**
     * Format the URL
     * @returns {string} - Formatted URL
     */
    toString() {
        if (!this.#valid) {
            throw new Error('Cannot format invalid URL');
        }

        const pathWithoutLeadingSlash = this.#path.replace(/^\//, '');

        if (this.#format === 'full' && this.#sessionId && this.#workspaceId) {
            return `${this.#sessionId}@${this.#workspaceId}://${pathWithoutLeadingSlash}`;
        } else if (this.#format === 'workspace' && this.#workspaceId) {
            return `${this.#workspaceId}://${pathWithoutLeadingSlash}`;
        } else {
            return this.#path;
        }
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

        if (this.#format === 'full' && this.#sessionId && this.#workspaceId) {
            return new Url(`${this.#sessionId}@${this.#workspaceId}://${path}`);
        } else if (this.#format === 'workspace' && this.#workspaceId) {
            return new Url(`${this.#workspaceId}://${path}`);
        } else {
            return new Url(path);
        }
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

        if (this.#workspaceId) {
            return new Url(`${sessionId}@${this.#workspaceId}://${this.#path.replace(/^\//, '')}`);
        } else {
            // If there's no workspace ID, we can't create a full URL
            throw new Error('Cannot set session ID without a workspace ID');
        }
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

        if (this.#sessionId) {
            return new Url(`${this.#sessionId}@${workspaceId}://${this.#path.replace(/^\//, '')}`);
        } else {
            return new Url(`${workspaceId}://${this.#path.replace(/^\//, '')}`);
        }
    }

    /**
     * Create a full URL with session ID and workspace ID
     * @param {string} sessionId - Session ID
     * @param {string} workspaceId - Workspace ID
     * @returns {Url} - New URL instance
     */
    withSessionAndWorkspace(sessionId, workspaceId) {
        if (!this.#valid) {
            throw new Error('Cannot modify invalid URL');
        }

        return new Url(`${sessionId}@${workspaceId}://${this.#path.replace(/^\//, '')}`);
    }
}

export default Url;
