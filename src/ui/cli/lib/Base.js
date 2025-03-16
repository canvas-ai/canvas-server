#!/usr/bin/env node

'use strict';

import fs from 'fs';
import path from 'path';
import os from 'os';
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;
import minimist from 'minimist';
import axios from 'axios';
import chalk from 'chalk';
import Table from 'cli-table3';
import debugInstance from 'debug';
import readline from 'readline';

const debug = debugInstance('canvas:cli');

// Default configuration
export const DEFAULT_CONFIG = {
  server: {
    url: 'http://localhost:8001/rest/v2'
  },
  auth: {
    token: ''
  },
  cli: {
    context: {
      machineId: '',
      id: '',
      name: 'CLI Context',
      description: 'Automatically created context for Canvas CLI'
    }
  },
  paths: {
    windows: {
      configDir: path.join(os.homedir(), 'Canvas', 'config')
    },
    unix: {
      configDir: path.join(os.homedir(), '.canvas', 'config')
    }
  },
  endpoints: {
    context: '/context',
    contexts: '/contexts',
    sessions: '/sessions',
    users: '/users',
    roles: '/roles',
    workspaces: '/workspaces',
    ping: '/ping',
    auth: {
      login: '/auth/login',
      tokens: '/auth/tokens',
      verify: '/auth/token/verify'
    }
  }
};

// Define the list of available Canvas modules
const CANVAS_MODULES = [
  'apps',
  'roles',
  'users',
  'identities',
  'documents',
  'notes', // alias for documents with feature data/abstr/notes
  'tabs',
  'files',
  'todo',
  'emails',
  'ws',     // workspace module
  'context', // context module
  'canvas'  // canvas module
];

// Define standard actions and their corresponding HTTP methods
const ACTION_HTTP_METHODS = {
  'list': 'GET',
  'get': 'GET',
  'set': 'PATCH',
  'update': 'PUT',
  'add': 'POST',
  'create': 'POST',
  'rm': 'DELETE',
  'del': 'DELETE',
  'delete': 'DELETE'
};

class BaseCLI {

  constructor() {
    this.configPath = this.getConfigPath();
    this.config = this.loadConfig();
    this.args = minimist(process.argv.slice(2), {
      string: ['context', '_'],
      alias: {
        c: 'context',
        f: 'feature',
        s: 'filter',
        t: 'tag',
        h: 'help',
        v: 'version'
      }
    });

    // Initialize input parameters
    this.module = null;
    this.action = null;
    this.contextArray = [];
    this.featureArray = [];
    this.filterArray = [];
    this.inputArgs = [];
    this.opts = {};
    this.data = null;

    // Parse input parameters
    this.parseInput();

    // Get the auth token from config
    const token = this.config.auth?.token || '';

    // Initialize API client
    this.api = axios.create({
      baseURL: this.config.server?.url || DEFAULT_CONFIG.server.url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });

    // Add request interceptor to handle authentication
    this.api.interceptors.request.use(
      (config) => {
        // Update token on each request in case it changed
        const currentToken = this.config.auth?.token || '';
        if (currentToken) {
          config.headers['Authorization'] = `Bearer ${currentToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  async printParsedInput() {
    console.log(JSON.stringify({
      module: this.module,
      action: this.action,
      contextArray: this.contextArray,
      featureArray: this.featureArray,
      filterArray: this.filterArray,
      inputArgs: this.inputArgs,
      opts: this.opts,
      data: this.data
    }, null, 2));
  }

  async run() {
    console.log('Do not call the Base CLI method directly.');
    return 1;
  }

  getConfigPath() {
    const platform = os.platform();
    let configDir;

    if (platform === 'win32') {
      configDir = DEFAULT_CONFIG.paths.windows.configDir;
    } else {
      configDir = DEFAULT_CONFIG.paths.unix.configDir;
    }

    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    return path.join(configDir, 'canvas-cli.json');
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const parsedConfig = JSON.parse(configData);

        // Merge with default config to ensure all properties exist
        return {
          server: { ...DEFAULT_CONFIG.server, ...parsedConfig.server },
          auth: { ...DEFAULT_CONFIG.auth, ...parsedConfig.auth },
          cli: {
            ...DEFAULT_CONFIG.cli,
            ...parsedConfig.cli,
            context: {
              ...DEFAULT_CONFIG.cli.context,
              ...(parsedConfig.cli?.context || {})
            },
            session: {
              ...DEFAULT_CONFIG.cli.session,
              ...(parsedConfig.cli?.session || {})
            }
          }
        };
      }
    } catch (err) {
      debug(`Error loading config: ${err.message}`);
    }

    // Return default config if loading fails
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      debug(`Config saved to ${this.configPath}`);
    } catch (err) {
      debug(`Error saving config: ${err.message}`);
      console.error(chalk.red(`Error saving config: ${err.message}`));
    }
  }

  async promptForCredentials() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      console.log(chalk.yellow('No authentication token found. Please log in:'));

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
          if (rl.stdoutMuted && stringToWrite.trim() !== '\n')
            rl.output.write('*');
          else
            rl.output.write(stringToWrite);
        };
      });
    });
  }

  async generateAuthToken() {
    debug('Generating auth token');
    try {
      // Prompt for credentials
      const credentials = await this.promptForCredentials();
      if (!credentials) {
        return false;
      }

      // Step 1: Login to get a session
      debug('Logging in with credentials');
      const loginResponse = await this.api.post(DEFAULT_CONFIG.endpoints.auth.login, {
        email: credentials.email,
        password: credentials.password
      });

      debug(`Login response: ${JSON.stringify(loginResponse.data)}`);

      // Check if login was successful
      if (!loginResponse.data || loginResponse.data.status !== 'success') {
        console.error(chalk.red('Error: Login failed.'));
        if (loginResponse.data && loginResponse.data.message) {
          console.error(chalk.red(`Reason: ${loginResponse.data.message}`));
        }
        return false;
      }

      debug('Login successful');

      // Store the email in the config
      this.config.auth.email = credentials.email;
      await this.saveConfig();
      debug('Email saved to config');

      // If the login response already contains a token, use it
      if (loginResponse.data.payload && loginResponse.data.payload.token) {
        debug('Using token from login response');
        this.config.auth.token = loginResponse.data.payload.token;
        await this.saveConfig();
        debug('Auth token saved');
        return true;
      }

      // Step 2: Generate API token
      debug('Generating API token');

      // Log the current headers
      debug(`Request headers for token generation: ${JSON.stringify(this.api.defaults.headers)}`);

      const tokenResponse = await this.api.post(DEFAULT_CONFIG.endpoints.auth.tokens, {
        name: 'Canvas CLI Token',
        expiresInDays: null // No expiration
      });

      debug(`Token response: ${JSON.stringify(tokenResponse.data)}`);

      if (tokenResponse.data && tokenResponse.data.status === 'success' &&
          tokenResponse.data.payload) {

        // Extract the token value from the response
        let tokenValue = null;

        if (tokenResponse.data.payload.value) {
          // Direct value
          tokenValue = tokenResponse.data.payload.value;
        } else if (tokenResponse.data.payload.token && tokenResponse.data.payload.token.value) {
          // Nested in token object
          tokenValue = tokenResponse.data.payload.token.value;
        } else if (tokenResponse.data.payload.token) {
          // The token itself
          tokenValue = tokenResponse.data.payload.token;
        }

        if (tokenValue) {
          this.config.auth.token = tokenValue;
          this.config.auth.email = credentials.email;
          await this.saveConfig();
          debug('Auth token generated and saved');
          return true;
        }

        console.error(chalk.red('Error: Could not extract token value from response.'));
        debug(`Token response payload: ${JSON.stringify(tokenResponse.data.payload)}`);
        return false;
      } else {
        console.error(chalk.red('Error: Failed to generate auth token.'));
        if (tokenResponse.data && tokenResponse.data.message) {
          console.error(chalk.red(`Reason: ${tokenResponse.data.message}`));
        }
        return false;
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      if (err.response) {
        debug(`Response status: ${err.response.status}`);
        debug(`Response data: ${JSON.stringify(err.response.data)}`);

        if (err.response.data && err.response.data.message) {
          console.error(chalk.red(`Server message: ${err.response.data.message}`));
        }
      }
      return false;
    }
  }

  async checkServerConnection() {
    debug('Checking server connection');
    try {
      const pingEndpoint = DEFAULT_CONFIG.endpoints.ping;
      debug(`Pinging server at ${this.config.server.url}${pingEndpoint}`);

      const response = await this.api.get(pingEndpoint);
      debug(`Ping response: ${JSON.stringify(response.data)}`);

      if (response.status === 200) {
        debug('Server is running');
        return true;
      }

      debug(`Unexpected ping response status: ${response.status}`);
      return false;
    } catch (err) {
      debug(`Server connection error: ${err.message}`);
      if (err.response) {
        debug(`Response status: ${err.response.status}`);
        debug(`Response data: ${JSON.stringify(err.response.data)}`);
      } else if (err.request) {
        debug('No response received from server');
      } else {
        debug('Error setting up the request');
      }
      return false;
    }
  }

  async getContext() {
    debug('Getting context');

    // Check if we have a context ID in the config
    if (this.config.cli.context.id) {
      debug(`Found context ID in config: ${this.config.cli.context.id}`);
    } else {
      // Generate a context ID based on machine ID
      const machineId = this.getMachineId();
      this.config.cli.context.id = `cli-${machineId}`;
      await this.saveConfig();
      debug(`Generated new context ID: ${this.config.cli.context.id}`);
    }

    try {
      // Use the contexts/:id endpoint with autoCreate=true
      let contextEndpoint = `${DEFAULT_CONFIG.endpoints.contexts}/${this.config.cli.context.id}?autoCreate=true`;

      // Add context name and description if available
      if (this.config.cli.context.name) {
        contextEndpoint += `&name=${encodeURIComponent(this.config.cli.context.name)}`;
      } else {
        contextEndpoint += `&name=${encodeURIComponent('CLI Context')}`;
      }

      if (this.config.cli.context.description) {
        contextEndpoint += `&description=${encodeURIComponent(this.config.cli.context.description)}`;
      } else {
        contextEndpoint += `&description=${encodeURIComponent('Automatically created context for Canvas CLI')}`;
      }

      debug(`Getting context from endpoint: ${contextEndpoint}`);
      const response = await this.api.get(contextEndpoint);

      if (response.data && response.data.data) {
        debug('Context retrieved successfully');
        return response.data.data;
      } else {
        debug('Invalid response format from context endpoint');
        return null;
      }
    } catch (error) {
      debug(`Error getting context: ${error.message}`);
      return null;
    }
  }

  // Helper method to get machine ID
  getMachineId() {
    if (!this.config.cli.context.machineId) {
      this.config.cli.context.machineId = machineIdSync(true).substr(0, 11);
      this.saveConfig();
    }
    return this.config.cli.context.machineId;
  }

  async initialize() {
    debug('Initializing CLI');

    // Check if server is running
    const serverRunning = await this.checkServerConnection();
    if (!serverRunning) {
      console.error(chalk.red('Error: Canvas server is not running or not accessible.'));
      console.error(chalk.yellow(`Make sure the server is running at ${this.config.server.url}`));
      return false;
    }

    // Check if we have a valid auth token
    if (this.config.auth.token) {
      const isAuthenticated = await this.isAuthenticated();
      if (!isAuthenticated) {
        debug('Auth token is invalid or expired');
        console.log(chalk.yellow('Your authentication token is invalid or expired.'));
        const tokenGenerated = await this.generateAuthToken();
        if (!tokenGenerated) {
          return false;
        }
      }
    } else {
      // No token, generate one
      debug('No auth token found');
      const tokenGenerated = await this.generateAuthToken();
      if (!tokenGenerated) {
        return false;
      }
    }

    // Get or create context
    const context = await this.getContext();
    if (!context) {
      debug('Failed to get or create context');
      return false;
    }

    return true;
  }

  printHelp() {
    console.log(`
${chalk.bold('USAGE')}
  ${chalk.cyan(this.commandName)} [options] [command]

${chalk.bold('OPTIONS')}
  ${chalk.yellow('-h, --help')}     Show this help message
  ${chalk.yellow('-v, --version')}  Show version information
    `);
  }

  printVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../..', 'package.json'), 'utf8'));
      console.log(`${this.commandName} version ${packageJson.version}`);
    } catch (err) {
      console.log(`${this.commandName} version unknown`);
    }
  }

  parseInput(input) {
    // Get the raw arguments
    const rawArgs = this.args['_'].slice(0);

    // Initialize module and action
    let module = null;
    let action = null;

    // If we have at least one argument
    if (rawArgs.length > 0) {
      // Check if the first argument is a known module
      if (CANVAS_MODULES.includes(rawArgs[0])) {
        module = rawArgs[0];
        // If we have a second argument, it's the action
        action = rawArgs.length > 1 ? rawArgs[1] : 'list'; // Default action is list
        // Remove module and action from args
        rawArgs.splice(0, 2);
      } else {
        // If not a module, it's just an action on the default module
        action = rawArgs[0];
        // Remove action from args
        rawArgs.splice(0, 1);
      }
    } else {
      // Default to help action if no arguments provided
      action = 'help';
    }

    // Parse the context array
    const contextArray = Array.isArray(this.args.context)
      ? this.args.context
      : (this.args.context ? [this.args.context] : []);

    // Parse the "features" array
    const featureArray = Array.isArray(this.args.feature)
      ? this.args.feature
      : (this.args.feature ? [this.args.feature] : []);

    // Parse the "tags" array and convert to feature format
    const tagArray = Array.isArray(this.args.tag)
      ? this.args.tag.map(tag => `tag/${tag}`)
      : (this.args.tag ? [`tag/${this.args.tag}`] : []);

    // Combine features and tags
    const combinedFeatures = [...featureArray, ...tagArray];

    // Parse the "filters" array
    const filterArray = Array.isArray(this.args.filter)
      ? this.args.filter
      : (this.args.filter ? [this.args.filter] : []);

    // Parse the rest of the supplied arguments
    const args = rawArgs;
    const opts = { ...this.args };
    delete opts['_'];

    // Handle special case for notes (alias for documents with notes feature)
    if (module === 'notes') {
      module = 'documents';
      if (!combinedFeatures.includes('data/abstr/notes')) {
        combinedFeatures.push('data/abstr/notes');
      }
    }

    // Get the data from input if provided
    const data = input || null;

    // Bind the parsed input to the class instance
    this.module = module;
    this.action = action;
    this.contextArray = contextArray;
    this.featureArray = combinedFeatures;
    this.filterArray = filterArray;
    this.inputArgs = args;
    this.opts = opts;
    this.data = data;

    // Also return the parsed input for backward compatibility
    return {
      module,
      action,
      contextArray,
      featureArray: combinedFeatures,
      filterArray,
      args,
      opts,
      data
    };
  }

  createTable(headers) {
    return new Table({
      head: headers.map(header => chalk.cyan.bold(header)),
      chars: {
        'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
        'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
        'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
        'right': '║', 'right-mid': '╢', 'middle': '│'
      },
      style: {
        head: ['cyan', 'bold'],
        border: ['white'],
        compact: false
      }
    });
  }

  async isAuthenticated() {
    debug('Checking if user is authenticated');
    if (!this.config.auth?.token) {
      debug('No auth token found');
      return false;
    }

    try {
      const response = await this.api.post(DEFAULT_CONFIG.endpoints.auth.verify, {
        token: this.config.auth.token
      });

      debug(`Token verification response: ${JSON.stringify(response.data)}`);

      return response.data && response.data.status === 'success';
    } catch (err) {
      debug(`Authentication check failed: ${err.message}`);
      if (err.response) {
        debug(`Response status: ${err.response.status}`);
        debug(`Response data: ${JSON.stringify(err.response.data)}`);
      }
      return false;
    }
  }
}

export default BaseCLI;
