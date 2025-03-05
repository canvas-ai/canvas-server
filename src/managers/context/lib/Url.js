'use strict';

/**
 * Context URL Parser
 *
 * Formats supported:
 * - session-name@workspace-name://path - Full format with session and workspace
 * - workspace-name://path - Format with only workspace
 * - /path or path - Simple path format (uses current workspace)
 */

// Constants
// TODO: Remove these, the only exception may be to validate a URL against a base URL
const DEFAULT_BASE_URL = '/'
const DEFAULT_PATH = '/'
const DEFAULT_SESSION_ID = null
const DEFAULT_WORKSPACE_ID = 'universe'

class Url {

    #raw;
    #url;
    #sessionID;
    #workspaceID;
    #path;
    #pathArray;
    #valid = false;

    constructor(url) {
        this.#raw = url;
        this.setUrl(url);
    }

    get raw() { return this.#raw; } // Unparsed URL
    get url() { return this.#url; } // Full URL string
    get sessionID() { return this.#sessionID; }
    get workspaceID() { return this.#workspaceID; }
    get path() { return this.#path; }
    get pathArray() { return this.#pathArray; }
    get isValid() { return this.#valid; }

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

            // Set the session ID
            this.#sessionID = this.parseSession(preprocessedUrl);

            // Set the workspace ID
            this.#workspaceID = this.parseWorkspace(preprocessedUrl);

            // Set the URL path
            this.#path = this.parsePath(preprocessedUrl);

            // Store the sanitized URL
            this.#url = this.formatUrl();

            // Set the URL path array
            this.#pathArray = this.#path.split('/').filter(segment => segment.length > 0);

            this.#valid = true;
        } catch (error) {
            this.#valid = false;
            this.#url = null;
            this.#sessionID = DEFAULT_SESSION_ID;
            this.#workspaceID = DEFAULT_WORKSPACE_ID;
            this.#path = DEFAULT_PATH;
            this.#pathArray = [];

            throw error;
        }
    }

    validate(url) { return Url.validate(url); }
    static validate(url) {
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL: URL must be a string');
        }

        // Check for disallowed special characters, but allow backslashes
        if (/[`$%^*;'",<>{}[\]]/gi.test(url)) {
            throw new Error(`Unsupported characters in the context URL, got "${url}"`);
        }

        return url;
    }

    // Format the URL based on the parsed components
    formatUrl() {
        if (this.#sessionID && this.#workspaceID) {
            return `${this.#sessionID}@${this.#workspaceID}://${this.#path.replace(/^\//, '')}`;
        } else if (this.#workspaceID) {
            return `${this.#workspaceID}://${this.#path.replace(/^\//, '')}`;
        } else {
            return this.#path;
        }
    }

    // Parse the session portion of the url if present
    parseSession(url) {
        const sessionRegex = /^([^@]+)@([^:/]+):\/\/(.*)$/;
        const sessionMatch = url.match(sessionRegex);

        if (sessionMatch && sessionMatch.length >= 2) {
            return sessionMatch[1];
        }

        return DEFAULT_SESSION_ID;
    }

    // Parse the workspace portion of the url if present
    parseWorkspace(url) {
        // First check if there's a session prefix
        const sessionWorkspaceRegex = /^([^@]+)@([^:/]+):\/\/(.*)$/;
        const sessionWorkspaceMatch = url.match(sessionWorkspaceRegex);

        if (sessionWorkspaceMatch && sessionWorkspaceMatch.length >= 3) {
            return sessionWorkspaceMatch[2];
        }

        // If no session, check for just workspace
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
        // Handle full format: session@workspace://path
        const fullFormatRegex = /^([^@]+)@([^:/]+):\/\/(.*)$/;
        const fullFormatMatch = url.match(fullFormatRegex);

        if (fullFormatMatch && fullFormatMatch.length >= 4) {
            let path = fullFormatMatch[3];
            return path.startsWith('/') ? path : '/' + path;
        }

        // Handle workspace format: workspace://path
        const workspaceFormatRegex = /^([^:/]+):\/\/(.*)$/;
        const workspaceFormatMatch = url.match(workspaceFormatRegex);

        if (workspaceFormatMatch && workspaceFormatMatch.length >= 3) {
            let path = workspaceFormatMatch[2];
            return path.startsWith('/') ? path : '/' + path;
        }

        // Handle simple path format
        return url.startsWith('/') ? url : '/' + url;
    }
}

export default Url;
