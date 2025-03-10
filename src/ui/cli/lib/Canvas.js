#!/usr/bin/env node

'use strict';

import chalk from 'chalk';
import BaseCLI from './Base.js';
import axios from 'axios';

// Import DEFAULT_CONFIG from BaseCLI
import { DEFAULT_CONFIG } from './Base.js';

class CanvasCLI extends BaseCLI {
  constructor() {
    super();
    this.commandName = 'canvas';
  }

  printHelp() {
    console.log(`
${chalk.bold('Canvas CLI')} - Command-line interface for Canvas

${chalk.bold('Usage:')}
  ${this.commandName} [command] [options]

${chalk.bold('Commands:')}
  ${chalk.cyan('status')}                 Show server status
  ${chalk.cyan('login')}                  Authenticate with Canvas server (generates API token)
  ${chalk.cyan('login <token>')}          Set authentication token directly
  ${chalk.cyan('ping')}                   Check server connection
  ${chalk.cyan('users')}                  List all users
  ${chalk.cyan('roles')}                  List all roles
  ${chalk.cyan('config')}                 Show current configuration
  ${chalk.cyan('config set <key> <val>')} Set configuration value

${chalk.bold('Examples:')}
  ${chalk.gray('# Check server status')}
  ${this.commandName} status

  ${chalk.gray('# Authenticate with Canvas server')}
  ${this.commandName} login

  ${chalk.gray('# Set authentication token directly')}
  ${this.commandName} login YOUR_TOKEN

  ${chalk.gray('# Set server URL')}
  ${this.commandName} config set server.url http://localhost:8001/rest/v2
    `);
  }

  async login(args) {
    try {
      // Check if a token was provided directly
      if (args && args.length > 0) {
        const token = args[0];
        console.log(chalk.yellow(`Setting authentication token manually...`));
        this.config.auth.token = token;
        this.saveConfig();
        console.log(chalk.green('Token set successfully!'));
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
      this.saveConfig();

      console.log(chalk.cyan('Starting authentication process:'));
      console.log(chalk.cyan('1. Logging in with credentials'));
      console.log(chalk.cyan('2. Generating API token'));
      console.log(chalk.cyan('3. Storing token and logging out session'));
      console.log('');

      const success = await this.generateAuthToken();
      if (success) {
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
      console.error(chalk.red(`Error: ${err.message}`));
      return 1;
    }
  }

  async status() {
    try {
      const statusEndpoint = DEFAULT_CONFIG.endpoints.status;
      const response = await this.api.get(statusEndpoint);

      if (response.data) {
        const status = response.data.data || response.data;

        const table = this.createTable(['Property', 'Value']);

        table.push(['Status', status.status || 'Unknown']);
        table.push(['Version', status.version || 'Unknown']);
        table.push(['Uptime', status.uptime || 'Unknown']);

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting server status: ${err.message}`));
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

        users.forEach(user => {
          table.push([
            user.id,
            user.username || 'N/A',
            user.email || 'N/A',
            user.role || 'user',
            user.status || 'active'
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

        roles.forEach(role => {
          table.push([
            role.id,
            role.name || 'N/A',
            role.description || 'N/A'
          ]);
        });

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error listing roles: ${err.message}`));
      return 1;
    }
  }

  async config(args) {
    if (args.length > 0 && args[0] === 'set') {
      return await this.configSet(args.slice(1));
    }

    // Display current configuration
    const table = this.createTable(['Property', 'Value']);

    table.push(['Server URL', this.config.server?.url || DEFAULT_CONFIG.server.url]);
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
      console.log(chalk.yellow(`Pinging server at ${this.config.server.url}...`));

      // Create a new axios instance without auth headers
      const pingClient = axios.create({
        baseURL: this.config.server.url,
        timeout: 5000 // 5 second timeout
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
        }

        return 0;
      } catch (err) {
        // If we get a 401 or 400, it means the server is running but the ping endpoint
        // might still require authentication (server hasn't been restarted with our fix)
        if (err.response && (err.response.status === 401 || err.response.status === 400)) {
          console.log(chalk.green('Server is alive, but the ping endpoint requires authentication.'));
          console.log(chalk.yellow('You may need to restart the server for the ping endpoint to be accessible without authentication.'));
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
      const { action, args } = this.parseInput();

      // Commands that don't require server connection or authentication
      if (action === 'ping') {
        return await this.ping();
      }

      // Login command requires server connection but not authentication
      if (action === 'login') {
        return await this.login(args);
      }

      // All other commands require server connection and authentication
      try {
        await this.initialize();

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
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      return 1;
    }
  }
}

export default CanvasCLI;
