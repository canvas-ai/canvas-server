'use strict';

/**
 * Context URL Parser
 *
 * Formats supported:
 * - workspace-name://path - Format with workspace and path
 * - /path or path - Simple path format (uses current workspace)
 */

// Constants
// TODO: Remove these, the only exception may be to validate a URL against a base URL
const DEFAULT_PATH = '/';
const DEFAULT_WORKSPACE_ID = 'universe';

class Url {
    #raw;
    #url;
    #workspaceID;
    #path;
    #pathArray;
    #valid = false;

    constructor(url) {
        this.#raw = url;
        this.setUrl(url);
    }

    get raw() {
        return this.#raw;
    } // Unparsed URL
    get url() {
        return this.#url;
    } // Full URL string
    get workspaceID() {
        return this.#workspaceID;
    }
    get path() {
        return this.#path;
    }
    get pathArray() {
        return this.#pathArray;
    }
    get isValid() {
        return this.#valid;
    }

    setUrl(url) {
        try {
            // Store the raw input
            this.#raw = url;

            // Validate the URL
            Url.validate(url);

            // Pre-process the URL to handle spaces and backslashes before parsing
            const preprocessedUrl = url
                .replace(/\\/g, '/') // Standardize on forward slashes
                .replace(/ +/g, '_'); // Replace spaces with underscores

            // Set the workspace ID
            this.#workspaceID = this.parseWorkspace(preprocessedUrl);

            // Set the URL path
            this.#path = this.parsePath(preprocessedUrl);

            // Store the sanitized URL
            this.#url = this.formatUrl();

            // Set the URL path array
            this.#pathArray = this.#path.split('/').filter((segment) => segment.length > 0);

            this.#valid = true;
        } catch (error) {
            this.#valid = false;
            this.#url = null;
            this.#workspaceID = DEFAULT_WORKSPACE_ID;
            this.#path = DEFAULT_PATH;
            this.#pathArray = [];

            throw error;
        }
    }

    validate(url) {
        return Url.validate(url);
    }
    static validate(url) {
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL: URL must be a string');
        }

        // Check for disallowed special characters
        if (/[`$%^*;'",<>{}[\]]/gi.test(url)) {
            throw new Error(`Unsupported characters in the context URL, got "${url}"`);
        }

        return url;
    }

    // Format the URL based on the parsed components
    formatUrl() {
        if (this.#workspaceID) {
            return `${this.#workspaceID}://${this.#path.replace(/^\//, '')}`;
        } else {
            return this.#path;
        }
    }

    // Parse the workspace portion of the url if present
    parseWorkspace(url) {
        // Check for workspace format with protocol
        const workspaceRegex = /^([^:/]+):\/\/(.*)$/;
        const workspaceMatch = url.match(workspaceRegex);

        if (workspaceMatch && workspaceMatch.length >= 2) {
            return workspaceMatch[1];
        }

        // If it's just a path, use the default workspace
        return DEFAULT_WORKSPACE_ID;
    }

    // Parse the path portion of the url
    parsePath(url) {
        // Handle workspace format: workspace://path
        const workspaceRegex = /^([^:/]+):\/\/(.*)$/;
        const workspaceMatch = url.match(workspaceRegex);

        if (workspaceMatch && workspaceMatch.length >= 3) {
            const path = workspaceMatch[2];
            return path.startsWith('/') ? path : '/' + path;
        }

        // Handle simple path format
        return url.startsWith('/') ? url : '/' + url;
    }
}

export default Url;
