#!/usr/bin/env node

'use strict';

import axios from 'axios';
import chalk from 'chalk';
import debugInstance from 'debug';
import { v4 as uuidv4 } from 'uuid';
import BaseCLI, { DEFAULT_CONFIG } from './BaseCLI.js';
import readline from 'readline';

const debug = debugInstance('canvas:cli:canvas');

// Define standard actions and their corresponding HTTP methods
const ACTION_HTTP_METHODS = {
    list: 'GET',
    get: 'GET',
    set: 'PATCH',
    update: 'PUT',
    add: 'POST',
    create: 'POST',
    rm: 'DELETE',
    del: 'DELETE',
    delete: 'DELETE',
};

class CanvasCLI extends BaseCLI {
    constructor() {
        super();
        this.commandName = 'canvas';
    }

    async run() {
        if (this.args.v || this.args.version) {
            this.printVersion();
            return 0;
        }

        if (!this.args || this.args.h || this.args.help) {
            this.printHelp();
            return 0;
        }

        try {
            // parseInput is already called in the constructor, so we can use the class properties directly
            const { module, action, inputArgs } = this;

            // Commands that don't require server connection or authentication
            if (action === 'help') {
                this.printHelp();
                return 0;
            }

            if (action === 'ping') {
                return await this.ping();
            }

            // Login and register commands require server connection but not authentication
            if (action === 'login') {
                return await this.login(inputArgs);
            }

            if (action === 'register') {
                return await this.register(inputArgs);
            }

            // Version command doesn't require authentication
            if (action === 'version') {
                this.printVersion();
                return 0;
            }

            // Config command doesn't require authentication
            if (action === 'config') {
                return await this.configCmd(inputArgs);
            }

            // All other commands require server connection and authentication
            try {
                await this.initialize();

                // Check if we have a specific method for this action
                if (typeof this[action] === 'function') {
                    return await this[action](inputArgs);
                }

                // Check if we have a specific method for this module and action
                const moduleActionMethod = `${module}${action.charAt(0).toUpperCase() + action.slice(1)}`;
                if (module && typeof this[moduleActionMethod] === 'function') {
                    return await this[moduleActionMethod](inputArgs);
                }

                // If no specific method, use the generic module action handler
                return await this.executeModuleAction();
            } catch (err) {
                // If the error is about authentication and the action is help, show help anyway
                if (err.message.includes('authentication') && action === 'help') {
                    this.printHelp();
                    return 0;
                }

                console.error(chalk.red(`Error: ${err.message}`));
                return 1;
            }
        } catch (err) {
            console.error(chalk.red(`Error: ${err.message}`));
            return 1;
        }
    }

    printHelp() {
        console.log(`
${chalk.bold('Canvas CLI')} - Command-line interface for Canvas

${chalk.bold('Usage:')}
  ${this.commandName} [module] [action] [options]
  ${this.commandName} [action] [options]

${chalk.bold('Modules:')}
  ${chalk.cyan('apps')}                   Application management
  ${chalk.cyan('roles')}                  Role management
  ${chalk.cyan('users')}                  User management
  ${chalk.cyan('identities')}             User identity management
  ${chalk.cyan('documents')}              Document management
  ${chalk.cyan('notes')}                  Notes management (alias for documents with notes feature)
  ${chalk.cyan('tabs')}                   Tab management
  ${chalk.cyan('files')}                  File management
  ${chalk.cyan('todo')}                   Todo management
  ${chalk.cyan('emails')}                 Email management
  ${chalk.cyan('ws')}                     Workspace management
  ${chalk.cyan('context')}                Context management
  ${chalk.cyan('canvas')}                 Canvas system management

${chalk.bold('Common Actions:')}
  ${chalk.cyan('list')}                   List items (default action)
  ${chalk.cyan('get <id>')}               Get item by ID
  ${chalk.cyan('add')}                    Add new item
  ${chalk.cyan('set <id>')}               Update item by ID
  ${chalk.cyan('rm <id>')}                Remove item by ID from context
  ${chalk.cyan('del <id>')}               Delete item by ID

${chalk.bold('Special Commands:')}
  ${chalk.cyan('status')}                 Show server status
  ${chalk.cyan('login')}                  Authenticate with Canvas server (generates API token)
  ${chalk.cyan('login <token>')}          Set authentication token directly
  ${chalk.cyan('register')}               Register a new user account
  ${chalk.cyan('ping')}                   Check server connection
  ${chalk.cyan('config')}                 Show current configuration
  ${chalk.cyan('config set <key> <val>')} Set configuration value

${chalk.bold('Configuration Keys:')}
  ${chalk.cyan('server.url')}             Server URL (e.g., http://localhost:8001/rest/v2)
  ${chalk.cyan('auth.token')}             Authentication token
  ${chalk.cyan('auth.email')}             User email address

${chalk.bold('Options:')}
  ${chalk.cyan('-c, --context <ctx>')}    Specify context
  ${chalk.cyan('-f, --feature <feat>')}   Filter by feature
  ${chalk.cyan('-s, --filter <filter>')}  Apply filter
  ${chalk.cyan('-t, --tag <tag>')}        Filter by tag
  ${chalk.cyan('-h, --help')}             Show help
  ${chalk.cyan('-v, --version')}          Show version

${chalk.bold('Examples:')}
  ${this.commandName} users list
  ${this.commandName} documents list -c work/project1
  ${this.commandName} notes list -t important
  ${this.commandName} documents get 123456
  ${this.commandName} config set server.url http://localhost:8001/rest/v2
`);
    }

    async login(args) {
        try {
            // Check if a token was provided directly
            if (args && args.length > 0) {
                const token = args[0];
                console.log(chalk.yellow('Setting authentication token manually...'));
                this.config.auth.token = token;
                this.saveConfig();

                // Update the API client with the new token
                this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                console.log(chalk.green('Token set successfully!'));

                // Verify the token works
                try {
                    const isAuthenticated = await this.isAuthenticated();
                    if (isAuthenticated) {
                        console.log(chalk.green('Token verified successfully!'));
                    } else {
                        console.log(chalk.yellow('Warning: Token could not be verified. It may be invalid.'));
                    }
                } catch (err) {
                    console.log(chalk.yellow(`Warning: Could not verify token: ${err.message}`));
                }

                return 0;
            }

            // Check if server is running before proceeding
            const serverRunning = await this.checkServerConnection();
            if (!serverRunning) {
                console.error(chalk.red(`Cannot connect to server at ${this.config.server.url}`));
                console.error(chalk.yellow('Please check if the server is running.'));
                return 1;
            }

            // Clear existing token to force re-authentication
            this.config.auth.token = '';
            this.api.defaults.headers.common['Authorization'] = '';
            this.saveConfig();

            console.log(chalk.cyan('Starting authentication process:'));
            console.log(chalk.cyan('1. Logging in with credentials'));
            console.log(chalk.cyan('2. Generating API token'));
            console.log(chalk.cyan('3. Storing token and logging out session'));
            console.log('');

            // Enable debug mode for this operation
            const originalDebugLevel = process.env.DEBUG;
            process.env.DEBUG = 'canvas:*';

            const success = await this.generateAuthToken();

            // Restore original debug level
            process.env.DEBUG = originalDebugLevel;

            if (success) {
                // Update the API client with the new token
                this.api.defaults.headers.common['Authorization'] = `Bearer ${this.config.auth.token}`;

                console.log(chalk.green('Authentication workflow completed successfully!'));
                console.log(chalk.green('You can now use the CLI with your API token.'));
                return 0;
            } else {
                console.error(chalk.red('Authentication workflow failed.'));
                console.log(chalk.yellow('If you have a token, you can set it manually:'));
                console.log(chalk.cyan(`  ${this.commandName} login YOUR_TOKEN`));
                console.log(chalk.yellow('Or configure it directly:'));
                console.log(chalk.cyan(`  ${this.commandName} config set auth.token YOUR_TOKEN`));
                console.log('');
                console.log(chalk.yellow('For debugging, try running with debug enabled:'));
                console.log(chalk.cyan('  DEBUG=canvas:* ./bin/canvas login'));
                return 1;
            }
        } catch (err) {
            console.error(chalk.red(`Error during login: ${err.message}`));
            if (err.response) {
                console.error(chalk.red(`Response status: ${err.response.status}`));
                if (err.response.data && err.response.data.message) {
                    console.error(chalk.red(`Server message: ${err.response.data.message}`));
                }
            }
            console.log(chalk.yellow('For debugging, try running with debug enabled:'));
            console.log(chalk.cyan('  DEBUG=canvas:* ./bin/canvas login'));
            return 1;
        }
    }

    /**
     * Register a new user
     * @param {Array} args - Command line arguments
     * @returns {Promise<number>} - Exit code
     */
    async register(args) {
        try {
            // Check if server is running before proceeding
            const serverRunning = await this.checkServerConnection();
            if (!serverRunning) {
                console.error(chalk.red(`Cannot connect to server at ${this.config.server.url}`));
                console.error(chalk.yellow('Please check if the server is running.'));
                return 1;
            }

            console.log(chalk.cyan('Starting user registration process:'));

            // Prompt for email and password with a clearer message
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const credentials = await new Promise((resolve) => {
                console.log(chalk.yellow('Please enter your details to create a new account:'));

                rl.question('Email: ', (email) => {
                    rl.stdoutMuted = true;
                    rl.question('Password: ', (password) => {
                        rl.stdoutMuted = false;
                        rl.close();
                        console.log(''); // Add a newline after password input
                        resolve({ email, password });
                    });

                    // Handle password masking
                    rl._writeToOutput = function _writeToOutput(stringToWrite) {
                        if (rl.stdoutMuted && stringToWrite.trim() !== '\n') {
                            rl.output.write('*');
                        } else {
                            rl.output.write(stringToWrite);
                        }
                    };
                });
            });

            if (!credentials) {
                console.error(chalk.red('Registration cancelled.'));
                return 1;
            }

            const { email, password } = credentials;

            // Validate email and password
            if (!email || !email.includes('@')) {
                console.error(chalk.red('Invalid email address.'));
                return 1;
            }

            if (!password || password.length < 8) {
                console.error(chalk.red('Password must be at least 8 characters long.'));
                return 1;
            }

            console.log(chalk.cyan(`Registering user with email: ${email}`));

            try {
                // Make the registration request
                const response = await axios.post(`${this.config.server.url}/auth/register`, {
                    email,
                    password,
                });

                if (response.data && response.data.status === 'success') {
                    console.log(chalk.green('Registration successful!'));
                    console.log(chalk.green('You can now log in with your credentials:'));
                    console.log(chalk.cyan(`  ${this.commandName} login`));

                    // Store the email in the config
                    this.config.auth.email = email;
                    this.saveConfig();

                    // If the response includes a token, we can set it directly
                    if (response.data.payload && response.data.payload.token) {
                        console.log(chalk.green('Authentication token received. Setting it automatically...'));
                        this.config.auth.token = response.data.payload.token;
                        this.saveConfig();

                        // Update the API client with the new token
                        this.api.defaults.headers.common['Authorization'] = `Bearer ${response.data.payload.token}`;

                        console.log(chalk.green('Token set successfully! You are now logged in.'));
                    }

                    return 0;
                } else {
                    console.error(chalk.red('Registration failed.'));
                    if (response.data && response.data.message) {
                        console.error(chalk.red(`Server message: ${response.data.message}`));
                    }
                    return 1;
                }
            } catch (err) {
                console.error(chalk.red(`Registration error: ${err.message}`));
                if (err.response) {
                    console.error(chalk.red(`Response status: ${err.response.status}`));
                    if (err.response.data && err.response.data.message) {
                        console.error(chalk.red(`Server message: ${err.response.data.message}`));
                    }
                }
                return 1;
            }
        } catch (err) {
            console.error(chalk.red(`Error during registration: ${err.message}`));
            return 1;
        }
    }

    async status() {
        try {
            const table = this.createTable(['Property', 'Value']);

            // Create a new axios instance without auth headers
            const pingClient = axios.create({
                baseURL: this.config.server.url,
                timeout: 5000,
            });

            try {
                // Try to ping the server using the configured endpoint
                const response = await pingClient.get('ping');

                if (response.data) {
                    table.push(['Status', response.data.status || 'Unknown']);
                    table.push(['Version', response.data.version || 'Unknown']);
                    table.push(['Product', response.data.productName || 'Unknown']);
                    table.push(['Platform', response.data.platform || 'Unknown']);
                    table.push(['Architecture', response.data.architecture || 'Unknown']);

                    if (response.data.serverIp) {
                        table.push(['Server IP', response.data.serverIp]);
                    }

                    if (response.data.serverHost && response.data.serverPort) {
                        table.push(['Server Host:Port', `${response.data.serverHost}:${response.data.serverPort}`]);
                    }

                    table.push(['Timestamp', response.data.timestamp || new Date().toISOString()]);
                } else {
                    table.push(['Status', 'Unknown']);
                    table.push(['Version', 'Unknown']);
                    table.push(['Product', 'Unknown']);
                    table.push(['Platform', 'Unknown']);
                    table.push(['Architecture', 'Unknown']);
                    table.push(['Timestamp', new Date().toISOString()]);
                }
            } catch (err) {
                debug(`Error getting server status: ${err.message}`);
                table.push(['Status', 'Unknown']);
                table.push(['Version', 'Unknown']);
                table.push(['Product', 'Unknown']);
                table.push(['Platform', 'Unknown']);
                table.push(['Architecture', 'Unknown']);
                table.push(['Timestamp', new Date().toISOString()]);
            }

            console.log(table.toString());
            return 0;
        } catch (err) {
            console.error(chalk.red(`Error: ${err.message}`));
            return 1;
        }
    }

    async users() {
        try {
            const usersEndpoint = DEFAULT_CONFIG.endpoints.users;
            const response = await this.api.get(usersEndpoint);

            if (response.data && response.data.data) {
                const users = response.data.data;

                if (users.length === 0) {
                    console.log(chalk.yellow('No users found.'));
                    return 0;
                }

                const table = this.createTable(['ID', 'Username', 'Email', 'Role', 'Status']);

                users.forEach((user) => {
                    table.push([
                        user.id,
                        user.username || 'N/A',
                        user.email || 'N/A',
                        user.role || 'user',
                        user.status || 'active',
                    ]);
                });

                console.log(table.toString());
            }
            return 0;
        } catch (err) {
            console.error(chalk.red(`Error listing users: ${err.message}`));
            return 1;
        }
    }

    async roles() {
        try {
            const rolesEndpoint = DEFAULT_CONFIG.endpoints.roles;
            const response = await this.api.get(rolesEndpoint);

            if (response.data && response.data.data) {
                const roles = response.data.data;

                if (roles.length === 0) {
                    console.log(chalk.yellow('No roles found.'));
                    return 0;
                }

                const table = this.createTable(['ID', 'Name', 'Description']);

                roles.forEach((role) => {
                    table.push([role.id, role.name || 'N/A', role.description || 'N/A']);
                });

                console.log(table.toString());
            }
            return 0;
        } catch (err) {
            console.error(chalk.red(`Error listing roles: ${err.message}`));
            return 1;
        }
    }

    async configCmd(args) {
        // Reset module to null to avoid confusion with the config command
        this.module = null;

        if (args.length > 0 && args[0] === 'set') {
            return await this.configSet(args.slice(1));
        }

        // Display current configuration
        const table = this.createTable(['Property', 'Value']);

        table.push(['Server URL', this.config.server?.url || DEFAULT_CONFIG.server.url]);
        table.push(['Auth Token', this.config.auth?.token ? '********' : 'Not set']);
        table.push(['Auth Email', this.config.auth?.email || 'Not set']);
        table.push(['Machine ID', this.config.cli?.context?.machineId || 'Not set']);
        table.push(['Context ID', this.config.cli?.context?.id || 'Not set']);
        table.push(['Session ID', this.config.cli?.session?.id || 'Not set']);

        console.log(table.toString());
        return 0;
    }

    async configSet(args) {
        if (args.length < 2) {
            console.error(chalk.red('Both key and value are required'));
            return 1;
        }

        const [key, value] = args;

        switch (key) {
            case 'server.url':
                this.config.server = this.config.server || {};
                this.config.server.url = value;
                break;
            case 'auth.token':
                this.config.auth = this.config.auth || {};
                this.config.auth.token = value;
                break;
            case 'auth.email':
                this.config.auth = this.config.auth || {};
                this.config.auth.email = value;
                break;
            default:
                console.error(chalk.red(`Unknown configuration key: ${key}`));
                return 1;
        }

        this.saveConfig();
        console.log(chalk.green(`Configuration updated: ${key} = ${value}`));
        return 0;
    }

    async ping() {
        try {
            console.log(chalk.yellow(`Pinging server at ${this.config.server.url}`));

            // Create a new axios instance without auth headers
            const pingClient = axios.create({
                baseURL: this.config.server.url,
                timeout: 5000,
            });

            try {
                // The ping endpoint is at the versioned path
                const response = await pingClient.get('ping');
                console.log(chalk.green('Server is alive!'));

                if (response.data) {
                    console.log(chalk.cyan('Server status:'), response.data.status || 'Unknown');
                    console.log(chalk.cyan('Server version:'), response.data.version || 'Unknown');
                    console.log(chalk.cyan('Product name:'), response.data.productName || 'Unknown');
                    console.log(chalk.cyan('Timestamp:'), response.data.timestamp || new Date().toISOString());
                    console.log(chalk.cyan('Platform:'), response.data.platform || process.platform);
                    console.log(chalk.cyan('Architecture:'), response.data.architecture || process.arch);

                    // Display server IP information if available
                    if (response.data.serverIp) {
                        console.log(chalk.cyan('Server IP:'), response.data.serverIp);
                    }
                    if (response.data.serverHost && response.data.serverPort) {
                        console.log(chalk.cyan('Server Host:Port:'), `${response.data.serverHost}:${response.data.serverPort}`);
                    }
                }

                return 0;
            } catch (err) {
                // If we get a 401 or 400, it means the server is running but the ping endpoint
                // might still require authentication (server hasn't been restarted with our fix)
                if (err.response && (err.response.status === 401 || err.response.status === 400)) {
                    console.log(chalk.green('Server is alive, but the ping endpoint requires authentication.'));
                    console.log(
                        chalk.yellow(
                            'You may need to restart the server for the ping endpoint to be accessible without authentication.',
                        ),
                    );
                    return 0;
                }

                // If we get a 404, it means the server is running but the endpoint doesn't exist
                if (err.response && err.response.status === 404) {
                    console.log(chalk.green('Server is alive, but the ping endpoint was not found.'));
                    console.log(chalk.yellow('Trying alternative method...'));

                    // Try the auth/login endpoint as a fallback
                    try {
                        await pingClient.get('auth/login');
                        console.log(chalk.green('Server is alive! (confirmed via auth endpoint)'));
                        return 0;
                    } catch (authErr) {
                        // If we get a 401 or 400, it means the server is running
                        if (authErr.response && (authErr.response.status === 401 || authErr.response.status === 400)) {
                            console.log(chalk.green('Server is alive! (confirmed via auth endpoint)'));
                            return 0;
                        }

                        // If we get here, the server might not be running
                        console.error(chalk.red(`Error connecting to server: ${authErr.message}`));
                        return 1;
                    }
                }

                // For any other error, the server might not be running
                console.error(chalk.red(`Error connecting to server: ${err.message}`));
                console.log(chalk.yellow('Please check if the server is running and the URL is correct.'));
                console.log(chalk.yellow(`Current server URL: ${this.config.server.url}`));
                return 1;
            }
        } catch (err) {
            console.error(chalk.red(`Error: ${err.message}`));
            return 1;
        }
    }

    /**
     * Get the API endpoint for a given module and context
     * @param {string} module - The module name
     * @param {Array} contextArray - Array of context identifiers
     * @returns {string} - The API endpoint
     */
    getModuleEndpoint(module, contextArray) {
        // Default endpoints based on module name
        const moduleEndpoints = {
            apps: '/apps',
            roles: '/roles',
            users: '/users',
            identities: '/user/identities',
            documents: '/documents',
            tabs: '/tabs',
            files: '/files',
            todo: '/todo',
            emails: '/emails',
            ws: '/workspaces',
            context: '/context',
            canvas: '/sessions',
        };

        // If no module specified, return null
        if (!module) {
            return null;
        }

        // Get the base endpoint for the module
        let endpoint = moduleEndpoints[module] || `/${module}`;

        // If we have context(s) and the module supports context scoping
        if (contextArray && contextArray.length > 0 && ['documents', 'tabs', 'files', 'todo', 'emails'].includes(module)) {
            // Use the first context in the array
            const contextId = contextArray[0];

            // Check if it's a full context URL or just an ID
            if (contextId.includes('@') && contextId.includes('://')) {
                // It's a full context URL, use the /context endpoint
                endpoint = `/context${endpoint}`;
            } else {
                // It's just an ID, use the /contexts/:id endpoint
                endpoint = `/contexts/${contextId}${endpoint}`;
            }
        }

        return endpoint;
    }

    /**
     * Execute an API request based on module, action, and other parameters
     * @returns {Promise<any>} - The API response
     */
    async executeModuleAction() {
        const { module, action, contextArray, featureArray, filterArray, inputArgs, opts, data } = this;

        // Get the API endpoint
        const endpoint = this.getModuleEndpoint(module, contextArray);

        // If no endpoint, return error
        if (!endpoint) {
            console.error(chalk.red(`Unknown module: ${module}`));
            this.printHelp();
            return 1;
        }

        // Determine the HTTP method based on the action
        let method = 'GET';
        if (ACTION_HTTP_METHODS[action]) {
            method = ACTION_HTTP_METHODS[action];
        }

        // Build the query parameters
        const queryParams = {};

        // Add features if any
        if (featureArray && featureArray.length > 0) {
            queryParams.features = featureArray;
        }

        // Add filters if any
        if (filterArray && filterArray.length > 0) {
            queryParams.filters = filterArray;
        }

        // Add context if any and not already in the endpoint
        if (contextArray && contextArray.length > 0 && !endpoint.includes('/context') && !endpoint.includes('/contexts/')) {
            queryParams.context = contextArray[0];
        }

        // Add any additional options
        if (opts) {
            Object.keys(opts).forEach((key) => {
                // Skip already processed options
                if (!['context', 'feature', 'filter', 'tag'].includes(key)) {
                    queryParams[key] = opts[key];
                }
            });
        }

        try {
            // Make the API request
            const response = await this.api.request({
                method,
                url: endpoint,
                params: method === 'GET' ? queryParams : undefined,
                data: method !== 'GET' ? data || queryParams : undefined,
            });

            // Check if the response was successful
            if (response.data && response.data.status === 'success') {
                // Format and return the response
                return this.formatResponse(response.data);
            } else {
                // Handle error response
                console.error(chalk.red(`Error: ${response.data?.message || 'Unknown error'}`));
                return 1;
            }
        } catch (error) {
            console.error(chalk.red(`Error executing ${action} on ${module}: ${error.message}`));
            if (error.response && error.response.data && error.response.data.message) {
                console.error(chalk.red(`Server message: ${error.response.data.message}`));
            }
            return 1;
        }
    }

    /**
     * Format the API response for display
     * @param {any} data - The API response data
     * @returns {any} - The formatted response
     */
    formatResponse(data) {
        // Extract payload if it exists
        let responseData = data;
        if (data && data.payload) {
            responseData = data.payload;
        }

        // If data is an array, create a table
        if (Array.isArray(responseData)) {
            if (responseData.length === 0) {
                console.log(chalk.yellow('No results found.'));
                return 0;
            }

            // Create a table with the data
            const headers = Object.keys(responseData[0]);
            const table = this.createTable(headers);

            // Add rows to the table
            responseData.forEach((item) => {
                const row = headers.map((header) => {
                    const value = item[header];
                    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value || '');
                    return chalk.white(stringValue);
                });
                table.push(row);
            });

            // Print the table
            console.log(table.toString());
            return 0;
        }

        // If data is an object, print it as JSON
        if (typeof responseData === 'object') {
            console.log(JSON.stringify(responseData, null, 2));
            return 0;
        }

        // Otherwise, just print the data
        console.log(responseData);
        return 0;
    }
}

export default CanvasCLI;
