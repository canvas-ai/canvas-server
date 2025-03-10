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
      url: '/',
      name: 'CLI Context',
      description: 'Automatically created context for Canvas CLI'
    },
    session: {
      id: '',
      name: 'CLI Session',
      description: 'Automatically created session for Canvas CLI'
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
    contexts: '/contexts',
    sessions: '/sessions',
    users: '/users',
    roles: '/roles',
    workspaces: '/workspaces',
    ping: '/ping',
  }
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

    this.api = axios.create({
      baseURL: this.config.server?.url || DEFAULT_CONFIG.server.url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.auth?.token || ''}`
      }
    });
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

    return path.join(configDir, 'cli.json');
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
    try {
      if (!this.config.auth.token) {
        const credentials = await this.promptForCredentials();

        try {
          // Step 1: Login with credentials to get a session token
          const authEndpoint = '/auth/login';
          debug(`Attempting login with endpoint: ${this.config.server.url}${authEndpoint}`);
          debug(`Using credentials for email: ${credentials.email}`);

          const requestData = {
            email: credentials.email,
            password: credentials.password
          };

          debug('Login request data:', JSON.stringify(requestData));
          const fullUrl = `${this.config.server.url}${authEndpoint}`;
          debug(`Making direct POST request to ${fullUrl}`);

          // Login to get the session token
          const loginResponse = await axios.post(fullUrl, requestData, {
            headers: {
              'Content-Type': 'application/json'
            }
          });

          debug('Login response status:', loginResponse.status);
          debug('Login response data:', JSON.stringify(loginResponse.data));

          if (!loginResponse.data || !loginResponse.data.data || !loginResponse.data.data.token) {
            console.error(chalk.red('Login failed: Invalid response from server'));
            debug('Server response:', JSON.stringify(loginResponse.data));
            return false;
          }

          // Extract the token from the login response
          const sessionToken = loginResponse.data.data.token;
          debug('Session token:', sessionToken);

          console.log(chalk.green('Login successful! Generating API token...'));

          // Step 2: Use the session token to generate an API token
          try {
            const tokenResponse = await axios.post(
              `${this.config.server.url}/auth/tokens`,
              {
                name: 'CLI Token',
                expiresInDays: 30
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken}`
                }
              }
            );

            debug('Token generation response:', JSON.stringify(tokenResponse.data));

            if (tokenResponse.data && tokenResponse.data.data && tokenResponse.data.data.value) {
              // Store the token value
              this.config.auth.token = tokenResponse.data.data.value;
              this.saveConfig();

              // Step 3: Logout to clean up the session (optional)
              try {
                await axios.post(
                  `${this.config.server.url}/auth/logout`,
                  {},
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${sessionToken}`
                    }
                  }
                );
                debug('Logout successful');
              } catch (logoutErr) {
                debug('Logout error (non-critical):', logoutErr.message);
                // We don't need to fail if logout fails
              }

              // Update API client with new token
              this.api = axios.create({
                baseURL: this.config.server.url,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${this.config.auth.token}`
                }
              });

              console.log(chalk.green('API token generated and stored successfully!'));
              return true;
            } else {
              console.error(chalk.red('Failed to generate API token: Invalid response from server'));
              debug('Token response:', JSON.stringify(tokenResponse.data));
              return false;
            }
          } catch (tokenErr) {
            console.error(chalk.red(`Failed to generate API token: ${tokenErr.message}`));
            debug('Token error:', tokenErr);

            if (tokenErr.response) {
              debug('Token error response:', JSON.stringify(tokenErr.response.data));

              if (tokenErr.response.status === 401) {
                console.error(chalk.yellow('Session expired or invalid. Please try logging in again.'));
              } else if (tokenErr.response.status === 404) {
                console.error(chalk.yellow('Token generation endpoint not found. Your server may not support API tokens.'));
                console.error(chalk.yellow('Using session token as fallback...'));

                // Use the session token as fallback
                this.config.auth.token = sessionToken;
                this.saveConfig();

                // Update API client with session token
                this.api = axios.create({
                  baseURL: this.config.server.url,
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                  }
                });

                console.log(chalk.green('Session token stored successfully!'));
                return true;
              }
            }

            return false;
          }
        } catch (loginErr) {
          console.error(chalk.red(`Authentication failed: ${loginErr.message}`));

          // Log more details about the error for debugging
          if (loginErr.response) {
            debug('Error response data:', JSON.stringify(loginErr.response.data));
            debug('Error response status:', loginErr.response.status);
            debug('Error response headers:', JSON.stringify(loginErr.response.headers));

            // Provide more specific error messages based on status code
            if (loginErr.response.status === 401) {
              console.error(chalk.yellow('Invalid credentials. Please check your email and password.'));

              // Check if there's a specific error message from the server
              if (loginErr.response.data && loginErr.response.data.message) {
                console.error(chalk.yellow(`Server message: ${loginErr.response.data.message}`));
              }
            } else if (loginErr.response.status === 404) {
              console.error(chalk.yellow('Authentication endpoint not found. Please check the server URL.'));
            } else if (loginErr.response.status >= 500) {
              console.error(chalk.yellow('Server error. Please try again later.'));
            }
          } else if (loginErr.request) {
            debug('Error request:', loginErr.request);
            console.error(chalk.yellow('No response from server. Please check if the server is running.'));
          }

          return false;
        }
      }
      return true;
    } catch (err) {
      console.error(chalk.red(`Authentication failed: ${err.message}`));
      return false;
    }
  }

  async initializeContext() {
    // Generate machine ID if not present
    if (!this.config.cli.context.machineId) {
      this.config.cli.context.machineId = machineIdSync(true).substr(0, 11);
      this.saveConfig();
    }

    // Create a dedicated context for the CLI app if no contextId is present
    if (!this.config.cli.context.id) {
      try {
        const contextId = `cli-${this.config.cli.context.machineId}`;
        const contextUrl = this.config.cli.context.url || DEFAULT_CONFIG.cli.context.url;
        const contextName = this.config.cli.context.name || DEFAULT_CONFIG.cli.context.name;
        const contextDescription = this.config.cli.context.description || DEFAULT_CONFIG.cli.context.description;

        const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
        const response = await this.api.post(contextEndpoint, {
          url: contextUrl,
          options: {
            name: `${contextName} (${this.config.cli.context.machineId})`,
            description: contextDescription
          }
        });

        if (response.data && response.data.data) {
          this.config.cli.context.id = response.data.data.id;
          this.saveConfig();
        }
      } catch (err) {
        debug(`Error creating context: ${err.message}`);
        console.error(chalk.red(`Error creating context: ${err.message}`));
      }
    }
  }

  async ensureSession() {
    if (!this.config.cli.session.id) {
      try {
        const sessionName = this.config.cli.session.name || DEFAULT_CONFIG.cli.session.name;
        const sessionDescription = this.config.cli.session.description || DEFAULT_CONFIG.cli.session.description;

        const sessionsEndpoint = DEFAULT_CONFIG.endpoints.sessions;
        const response = await this.api.post(sessionsEndpoint, {
          name: `${sessionName} (${this.config.cli.context.machineId})`,
          description: sessionDescription
        });

        if (response.data && response.data.data) {
          this.config.cli.session.id = response.data.data.id;
          this.saveConfig();
        }
      } catch (err) {
        debug(`Error creating session: ${err.message}`);
        console.error(chalk.red(`Error creating session: ${err.message}`));
      }
    }
  }

  async checkServerConnection() {
    try {
      // Create a new axios instance without auth headers
      const pingClient = axios.create({
        baseURL: this.config.server.url,
        timeout: 3000 // 3 second timeout
      });

      try {
        // Try the ping endpoint first
        await pingClient.get('ping');
        return true;
      } catch (pingErr) {
        // If ping fails with 401 or 400, server is still running
        if (pingErr.response && (pingErr.response.status === 401 || pingErr.response.status === 400)) {
          return true;
        }

        // Try the auth endpoint as fallback
        try {
          await pingClient.get('auth/login');
          return true;
        } catch (authErr) {
          // If auth fails with 401 or 400, server is still running
          if (authErr.response && (authErr.response.status === 401 || authErr.response.status === 400)) {
            return true;
          }

          // If we get here, server is probably not running
          return false;
        }
      }
    } catch (err) {
      return false;
    }
  }

  async initialize() {
    // Check if server is running before proceeding
    const serverRunning = await this.checkServerConnection();
    if (!serverRunning) {
      throw new Error(`Cannot connect to server at ${this.config.server.url}. Please check if the server is running.`);
    }

    // Ensure we have an auth token
    const authSuccess = await this.generateAuthToken();
    if (!authSuccess) {
      throw new Error('Authentication required to use the CLI');
    }

    await this.initializeContext();
    await this.ensureSession();
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
    // Parse the args array "_" to get the CLI "action"
    const action = this.args['_'][0] || 'help';

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
    const args = this.args['_'].slice(1);
    const opts = { ...this.args };
    delete opts['_'];

    return {
      action,
      contextArray,
      featureArray: combinedFeatures,
      filterArray,
      args,
      opts
    };
  }

  async run() {
    if (this.args.v || this.args.version) {
      this.printVersion();
      return 0;
    }

    if (this.args.h || this.args.help) {
      this.printHelp();
      return 0;
    }

    try {
      await this.initialize();
      const { action, args } = this.parseInput();

      if (typeof this[action] === 'function') {
        return await this[action](args);
      } else {
        console.error(chalk.red(`Unknown command: ${action}`));
        this.printHelp();
        return 1;
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      return 1;
    }
  }

  createTable(headers) {
    return new Table({
      head: headers.map(header => chalk.cyan(header)),
      chars: {
        'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
        'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
        'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
        'right': '║', 'right-mid': '╢', 'middle': '│'
      }
    });
  }
}

export default BaseCLI;
