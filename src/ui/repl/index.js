#!/usr/bin/env node
"use strict";

import { io } from "socket.io-client";
import readline from "readline";
import chalk from "chalk";
import figlet from "figlet";
import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import debugInstance from "debug";
import Table from "cli-table3";
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;

const debug = debugInstance("canvas:repl");

// Default configuration
const DEFAULT_CONFIG = {
  server: {
    url: "http://localhost:8001/rest/v2",
    wsUrl: "http://localhost:8001" // Socket.IO uses HTTP URL
  },
  auth: {
    token: "",
    email: ""
  },
  context: {
    id: `cli-${machineIdSync(true).substr(0, 11)}`,
    url: "/"
  },
  paths: {
    windows: {
      configDir: path.join(os.homedir(), "Canvas", "config")
    },
    unix: {
      configDir: path.join(os.homedir(), ".canvas", "config")
    }
  },
  endpoints: {
    auth: {
      login: "/auth/login",
      register: "/auth/register",
      tokens: "/auth/tokens",
      verify: "/auth/token/verify"
    },
    ping: "/ping"
  }
};

class CanvasREPL {
  constructor() {
    this.configPath = this.getConfigPath();
    this.config = this.loadConfig();
    this.currentContext = null;
    this.ws = null;
    this.rl = null;
    this.api = axios.create({
      baseURL: this.config.server.url,
      headers: {
        "Content-Type": "application/json",
        "Authorization": this.config.auth.token ? `Bearer ${this.config.auth.token}` : ""
      }
    });
  }

  getConfigPath() {
    const platform = os.platform();
    const configDir = platform === "win32"
      ? DEFAULT_CONFIG.paths.windows.configDir
      : DEFAULT_CONFIG.paths.unix.configDir;

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    return path.join(configDir, "canvas-cli.json");
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, "utf8");
        const parsedConfig = JSON.parse(configData);
        return {
          server: { ...DEFAULT_CONFIG.server, ...parsedConfig.server },
          auth: { ...DEFAULT_CONFIG.auth, ...parsedConfig.auth }
        };
      }
    } catch (err) {
      debug(`Error loading config: ${err.message}`);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  async saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf8");
      debug(`Config saved to ${this.configPath}`);
    } catch (err) {
      debug(`Error saving config: ${err.message}`);
      console.error(chalk.red(`Error saving config: ${err.message}`));
    }
  }

  async promptForCredentials(isRegister = false) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      console.log(chalk.yellow(isRegister ? "Please register:" : "Please log in:"));

      rl.question("Email: ", (email) => {
        rl.stdoutMuted = true;
        rl.question("Password: ", (password) => {
          rl.stdoutMuted = false;
          rl.close();
          console.log(""); // Add a newline after password input
          resolve({ email, password });
        });

        // Handle password masking
        rl._writeToOutput = function _writeToOutput(stringToWrite) {
          if (rl.stdoutMuted && stringToWrite.trim() !== "\n")
            rl.output.write("*");
          else
            rl.output.write(stringToWrite);
        };
      });
    });
  }

  async register() {
    try {
      const credentials = await this.promptForCredentials(true);
      const response = await this.api.post(DEFAULT_CONFIG.endpoints.auth.register, credentials);

      if (response.data && response.data.status === "success") {
        console.log(chalk.green("Registration successful! Please log in."));
        return this.login();
      } else {
        console.error(chalk.red("Registration failed:"));
        if (response.data && response.data.message) {
          console.error(chalk.red(response.data.message));
        }
        return false;
      }
    } catch (err) {
      console.error(chalk.red(`Registration error: ${err.message}`));
      if (err.response?.data?.message) {
        console.error(chalk.red(err.response.data.message));
      }
      return false;
    }
  }

  async login() {
    try {
      const credentials = await this.promptForCredentials();
      const response = await this.api.post(DEFAULT_CONFIG.endpoints.auth.login, credentials);

      if (response.data && response.data.status === "success") {
        this.config.auth.email = credentials.email;
        if (response.data.payload?.token) {
          this.config.auth.token = response.data.payload.token;
          await this.saveConfig();
          this.api.defaults.headers["Authorization"] = `Bearer ${this.config.auth.token}`;
          console.log(chalk.green("Login successful!"));
          return true;
        }
      }
      console.error(chalk.red("Login failed:"));
      if (response.data?.message) {
        console.error(chalk.red(response.data.message));
      }
      return false;
    } catch (err) {
      console.error(chalk.red(`Login error: ${err.message}`));
      if (err.response?.data?.message) {
        console.error(chalk.red(err.response.data.message));
      }
      return false;
    }
  }

  async logout() {
    this.config.auth.token = "";
    this.config.auth.email = "";
    await this.saveConfig();
    this.api.defaults.headers["Authorization"] = "";
    console.log(chalk.green("Logged out successfully!"));
  }

  async checkServerConnection() {
    try {
      const response = await this.api.get(DEFAULT_CONFIG.endpoints.ping);
      return response.status === 200;
    } catch (err) {
      debug(`Server connection error: ${err.message}`);
      return false;
    }
  }

  async isAuthenticated() {
    if (!this.config.auth.token) return false;
    try {
      const response = await this.api.post(DEFAULT_CONFIG.endpoints.auth.verify, {
        token: this.config.auth.token
      });
      return response.data?.status === "success";
    } catch (err) {
      debug(`Authentication check failed: ${err.message}`);
      return false;
    }
  }

  async initialize() {
    console.log(chalk.green(figlet.textSync("Canvas REPL", { horizontalLayout: "fitted" })));
    console.log(chalk.blue("Interactive CLI for Canvas Server"));
    console.log(chalk.gray("Type 'help' for available commands\n"));

    const serverRunning = await this.checkServerConnection();
    if (!serverRunning) {
      console.error(chalk.red("Error: Canvas server is not running or not accessible."));
      console.error(chalk.yellow(`Make sure the server is running at ${this.config.server.url}`));
      return false;
    }

    if (!await this.isAuthenticated()) {
      console.log(chalk.yellow("You are not authenticated."));
      const shouldRegister = await this.promptYesNo("Would you like to register? (y/n): ");
      if (shouldRegister) {
        if (!await this.register()) return false;
      } else {
        if (!await this.login()) return false;
      }
    }

    return true;
  }

  async promptYesNo(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.toLowerCase().startsWith("y"));
      });
    });
  }

  async listContexts() {
    return new Promise((resolve) => {
      this.ws.emit("session:context:list", { sessionId: "current" }, (response) => {
        if (response.status === "success" && response.data) {
          const table = new Table({
            head: [
              chalk.cyan("Context ID"),
              chalk.cyan("URL"),
              chalk.cyan("Name"),
              chalk.cyan("Description")
            ],
            style: {
              head: [], // Disable default bold style
              border: []
            }
          });

          response.data.forEach(context => {
            table.push([
              chalk.green(context.id || ""),
              chalk.yellow(context.url || ""),
              chalk.white(context.name || ""),
              chalk.gray(context.description || "")
            ]);
          });

          if (table.length === 0) {
            console.log(chalk.yellow("\nNo contexts found."));
          } else {
            console.log("\nAvailable Contexts:");
            console.log(table.toString());
          }
        } else {
          console.log(chalk.red("\nFailed to list contexts:"), response.message || "Unknown error");
        }
        resolve();
      });
    });
  }

  async  (contextUrl) {
    return new Promise((resolve) => {
      this.ws.emit("session:context:create", {
        url: contextUrl,
        options: {
          user: this.config.auth.email
        }
      }, (response) => {
        if (response.status === "success" && response.data) {
          const context = response.data;
          this.currentContext = context.id;
          this.config.context.id = context.id;
          this.config.context.url = context.url;
          this.saveConfig();
          console.log(chalk.green(`Created/Retrieved context: ${context.id}`));
          resolve(context);
        } else {
          console.log(chalk.red(`Failed to create context: ${response.message || "Unknown error"}`));
          resolve(null);
        }
      });
    });
  }

  // Available commands
  commands = {
    help: {
      description: "Show available commands",
      handler: () => {
        console.log(chalk.yellow("\nAvailable Commands:"));
        Object.keys(this.commands).forEach(cmd => {
          console.log(`  ${chalk.green(cmd.padEnd(15))} - ${this.commands[cmd].description}`);
        });
        console.log();
      }
    },
    list: {
      description: "List all available contexts",
      handler: async () => {
        await this.listContexts();
      }
    },
    login: {
      description: "Log in to the server",
      handler: async () => {
        if (await this.isAuthenticated()) {
          console.log(chalk.yellow("You are already logged in."));
          return;
        }
        await this.login();
      }
    },
    logout: {
      description: "Log out from the server",
      handler: async () => {
        if (!await this.isAuthenticated()) {
          console.log(chalk.yellow("You are not logged in."));
          return;
        }
        await this.logout();
      }
    },
    register: {
      description: "Register a new account",
      handler: async () => {
        if (await this.isAuthenticated()) {
          console.log(chalk.yellow("You are already logged in. Please log out first."));
          return;
        }
        await this.register();
      }
    },
    subscribe: {
      description: "Subscribe to a context ID",
      handler: (args) => {
        const contextId = args[0];
        if (!contextId) {
          console.log(chalk.red("Error: Context ID is required"));
          return;
        }

        this.currentContext = contextId;
        this.ws.emit("subscribe", { contextId });
        console.log(chalk.green(`Subscribed to context ${contextId}. You will get notified of updates.`));
      }
    },
    status: {
      description: "Show current connection status",
      handler: () => {
        console.log(chalk.yellow("\nConnection Status:"));
        console.log(`  Socket.IO: ${this.ws.connected ? chalk.green("Connected") : chalk.red("Disconnected")}`);
        console.log(`  Server: ${this.config.server.wsUrl}`);
        console.log(`  Current Context: ${this.currentContext ? chalk.green(this.currentContext) : chalk.gray("None")}\n`);
      }
    },
    clear: {
      description: "Clear the console",
      handler: () => {
        console.clear();
        console.log(chalk.green(figlet.textSync("Canvas REPL", { horizontalLayout: "fitted" })));
      }
    },
    exit: {
      description: "Exit the REPL",
      handler: () => {
        console.log(chalk.green("Goodbye!"));
        if (this.ws.connected) {
          this.ws.disconnect();
        }
        process.exit(0);
      }
    },
    create: {
      description: "Create or join a context by URL",
      handler: async (args) => {
        const contextUrl = args[0];
        if (!contextUrl) {
          console.log(chalk.red("Error: Context URL is required"));
          return;
        }
        await this.createContext(contextUrl);
      }
    }
  };

  initializeReadline() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.generatePrompt(),
      completer: (line) => {
        const completions = Object.keys(this.commands);
        const hits = completions.filter(c => c.startsWith(line));
        return [hits.length ? hits : completions, line];
      }
    });

    this.rl.on("line", (line) => {
      const args = line.trim().split(/\s+/);
      const cmd = args.shift().toLowerCase();

      if (cmd === "") {
        this.rl.prompt();
        return;
      }

      if (this.commands[cmd]) {
        this.commands[cmd].handler(args);
      } else {
        console.log(chalk.red(`Unknown command: ${cmd}`));
        console.log(chalk.gray("Type 'help' to see available commands"));
      }

      this.rl.prompt();
    });

    this.rl.on("close", () => {
      this.commands.exit.handler();
    });
  }

  initializeWebSocket() {
    // Initialize Socket.IO with auto-reconnection
    this.ws = io(this.config.server.wsUrl, {
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 10000,
      auth: {
        token: this.config.auth.token
      }
    });

    this.ws.on("connect", async () => {
      console.log(chalk.green(`Connected to Socket.IO server at ${this.config.server.wsUrl}`));

      // Update prompt on connect
      if (this.rl) {
        this.rl.setPrompt(this.generatePrompt());
        this.rl.prompt();
      }

      // If we have a context ID in config, try to create/retrieve it
      if (this.config.context.id) {
        await this.createContext(this.config.context.url);
      } else {
        // List available contexts on connection
        await this.listContexts();

        // Ask for context URL if no context is set
        this.rl.question(chalk.yellow("\nEnter context URL to create/join: "), async (contextUrl) => {
          if (contextUrl) {
            await this.createContext(contextUrl);
          }
          this.rl.prompt();
        });
      }
    });

    this.ws.on("context:update", (data) => {
      try {
        const { workspace, context, url } = data;
        console.log(chalk.magenta(`\nContext updated: ${workspace}://${context}/${url}`));
        this.rl.prompt();
      } catch (error) {
        console.log(chalk.red(`\nError handling context update: ${error.message}`));
        console.log(chalk.gray("Raw data:"), data);
        this.rl.prompt();
      }
    });

    this.ws.on("message", (data) => {
      console.log(chalk.cyan("\nReceived message:"), data);
      this.rl.prompt();
    });

    this.ws.on("disconnect", (reason) => {
      console.log(chalk.yellow(`\nDisconnected from server: ${reason}`));
      // Update prompt on disconnect
      if (this.rl) {
        this.rl.setPrompt(this.generatePrompt());
        this.rl.prompt();
      }
    });

    this.ws.on("connect_error", (error) => {
      console.log(chalk.red(`\nConnection error: ${error.message}`));
      this.rl.prompt();
    });
  }

  generatePrompt() {
    // Server status indicator (green/red dot)
    const serverStatus = this.ws?.connected
      ? chalk.green('●')
      : chalk.red('●');

    // Context URL segment
    const contextUrl = this.currentContext
      ? chalk.cyan(this.currentContext)
      : chalk.gray('no-context');

    // Powerlevel10k style segments
    const segments = [
      `${serverStatus}`,  // Server status
      `${contextUrl}`     // Context URL
    ];

    // Join segments with powerlevel10k style separator
    const prompt = segments.join(chalk.gray(' > '));

    // Add prompt character
    return `${prompt} ${chalk.blue('>')} `;
  }

  async start() {
    if (!await this.initialize()) {
      process.exit(1);
    }

    // Initialize WebSocket first
    this.initializeWebSocket();

    // Then initialize readline
    this.initializeReadline();

    // Handle process termination
    process.on("SIGINT", () => {
      this.commands.exit.handler();
    });
  }
}

// Start the REPL
const repl = new CanvasREPL();
repl.start().catch(err => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  process.exit(1);
});
