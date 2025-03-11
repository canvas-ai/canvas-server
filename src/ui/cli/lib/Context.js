#!/usr/bin/env node

'use strict';

import chalk from 'chalk';
import BaseCLI from './Base.js';
import debugInstance from 'debug';

// Import DEFAULT_CONFIG from BaseCLI
import { DEFAULT_CONFIG } from './Base.js';

const debug = debugInstance('canvas:cli:context');

class ContextCLI extends BaseCLI {
  constructor() {
    super();
    this.commandName = 'context';
  }

  async run() {
    if (this.args.v || this.args.version) {
      this.printVersion();
      return 0;
    }

    if (!this.args || this.args.h || this.args.help || !this.action) {
      this.printHelp();
      return 0;
    }

    try {
      // Commands that don't require server connection or authentication
      if (this.action === 'help') {
        this.printHelp();
        return 0;
      }

      // All other commands require server connection and authentication
      try {
        await this.initialize();

        // Check if we have a specific method for this action
        if (typeof this[this.action] === 'function') {
          return await this[this.action](this.inputArgs);
        } else {
          console.error(chalk.red(`Unknown command: ${this.action}`));
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

  printHelp() {
    console.log(`
${chalk.bold('USAGE')}
  ${chalk.cyan(this.commandName)} [options] [command]

${chalk.bold('COMMANDS')}
  ${chalk.yellow('list')}                     List all contexts
  ${chalk.yellow('set <url>')}                Set the context URL
  ${chalk.yellow('switch <id>')}              Switch to a different context
  ${chalk.yellow('url')}                      Show current context URL
  ${chalk.yellow('id')}                       Show current context ID
  ${chalk.yellow('path')}                     Show current context path
  ${chalk.yellow('bitmaps')}                  Show context bitmaps
  ${chalk.yellow('documents')}                List all documents in the context
  ${chalk.yellow('notes')}                    List all notes in the context
  ${chalk.yellow('note get <id/hash>')}       Get a specific note
  ${chalk.yellow('note add <content>')}       Add a new note
  ${chalk.yellow('tab add <url>')}            Add a new tab
  ${chalk.yellow('tab list')}                 List all tabs in the context
  ${chalk.yellow('query <query>')}            Execute a natural language query in the current context

${chalk.bold('OPTIONS')}
  ${chalk.yellow('-h, --help')}               Show this help message
  ${chalk.yellow('-v, --version')}            Show version information
  ${chalk.yellow('-f, --feature <feature>')}  Specify document feature(s)
  ${chalk.yellow('--filter <filter>')}         Specify filter(s) for the query
  ${chalk.yellow('--title <title>')}          Set document title
  ${chalk.yellow('--context <context>')}      Specify context URL
    `);
  }

  async list() {
    try {
      await this.initialize();

      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      const response = await this.api.get(contextsEndpoint);

      if (response.data && response.data.status === 'success' && response.data.payload) {
        const contexts = response.data.payload;

        if (contexts.length === 0) {
          console.log(chalk.yellow('No contexts found.'));
          return 0;
        }

        const table = this.createTable(['ID', 'URL', 'Workspace', 'Created']);

        contexts.forEach(context => {
          table.push([
            chalk.white(context.id || 'N/A'),
            chalk.white(context.url || 'N/A'),
            chalk.white(context.workspace || 'N/A'),
            chalk.white(context.created || 'N/A')
          ]);
        });

        console.log(table.toString());
      } else {
        console.error(chalk.red('Error: Failed to retrieve contexts.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }

      return 0;
    } catch (err) {
      console.error(chalk.red(`Error listing contexts: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async set(args) {
    try {
      await this.initialize();

      const url = args[0];

      if (!url) {
        console.error(chalk.red('Context URL is required'));
        return 1;
      }

      const contextId = this.getContextId();

      // Check if the URL contains a workspace ID
      if (url.includes('://')) {
        const [workspaceId, path] = url.split('://');

        // First, switch to the workspace
        try {
          // Use the contexts endpoint instead of context
          const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
          const response = await this.api.put(`${contextsEndpoint}/${contextId}/workspace`, {
            workspace: workspaceId,
            url: path
          });

          if (response.data && response.data.status === 'success') {
            console.log(chalk.green(`Switched to workspace ${workspaceId} with path ${path}`));
            return 0;
          } else {
            console.error(chalk.red('Error: Failed to switch workspace.'));
            if (response.data && response.data.message) {
              console.error(chalk.red(`Reason: ${response.data.message}`));
            }
            return 1;
          }
        } catch (err) {
          console.error(chalk.red(`Error switching workspace: ${err.message}`));
          if (err.response && err.response.data && err.response.data.message) {
            console.error(chalk.red(`Server message: ${err.response.data.message}`));
          }
          return 1;
        }
      } else {
        // Just update the URL path
        try {
          // Use the contexts endpoint instead of context
          const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
          const response = await this.api.put(`${contextsEndpoint}/${contextId}/url`, {
            url: url
          });

          if (response.data && response.data.status === 'success') {
            console.log(chalk.green(`Updated context URL to ${url}`));
            return 0;
          } else {
            console.error(chalk.red('Error: Failed to update context URL.'));
            if (response.data && response.data.message) {
              console.error(chalk.red(`Reason: ${response.data.message}`));
            }
            return 1;
          }
        } catch (err) {
          console.error(chalk.red(`Error updating context URL: ${err.message}`));
          if (err.response && err.response.data && err.response.data.message) {
            console.error(chalk.red(`Server message: ${err.response.data.message}`));
          }
          return 1;
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error setting context: ${err.message}`));
      return 1;
    }
  }

  async switch(args) {
    try {
      await this.initialize();

      const contextId = args[0];

      if (!contextId) {
        console.error(chalk.red('Context ID is required'));
        return 1;
      }

      // Get the context to verify it exists and get its details
      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      const response = await this.api.get(`${contextsEndpoint}/${contextId}`);

      if (response.data && response.data.status === 'success' && response.data.payload) {
        const context = response.data.payload;

        // Update the CLI config to use this context
        this.config.cli.context.id = contextId;
        this.saveConfig();

        console.log(chalk.green(`Switched to context ${contextId} at ${context.workspace || 'unknown'}://${context.url}`));
        return 0;
      } else {
        console.error(chalk.red('Error: Failed to switch context.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }
    } catch (err) {
      console.error(chalk.red(`Error switching context: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async url() {
    try {
      await this.initialize();

      const contextId = this.getContextId();

      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      const response = await this.api.get(`${contextsEndpoint}/${contextId}`);

      if (response.data && response.data.status === 'success' && response.data.payload) {
        const context = response.data.payload;
        console.log(`${context.workspace || 'unknown'}://${context.url}`);
      } else {
        console.error(chalk.red('Error: Failed to retrieve context URL.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting context URL: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async id() {
    try {
      await this.initialize();

      const contextId = this.getContextId();
      console.log(contextId);
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting context ID: ${err.message}`));
      return 1;
    }
  }

  async path() {
    try {
      await this.initialize();

      const contextId = this.getContextId();

      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      const response = await this.api.get(`${contextsEndpoint}/${contextId}`);

      if (response.data && response.data.status === 'success' && response.data.payload) {
        const context = response.data.payload;
        console.log(context.url);
      } else {
        console.error(chalk.red('Error: Failed to retrieve context path.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting context path: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async bitmaps() {
    try {
      await this.initialize();

      const contextId = this.getContextId();

      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      const response = await this.api.get(`${contextsEndpoint}/${contextId}/bitmaps`);

      if (response.data && response.data.status === 'success' && response.data.payload) {
        const bitmaps = response.data.payload;

        if (bitmaps.length === 0) {
          console.log(chalk.yellow('No bitmaps found.'));
          return 0;
        }

        const table = this.createTable(['Key', 'Size']);

        bitmaps.forEach(bitmap => {
          table.push([
            chalk.white(bitmap.key || 'N/A'),
            chalk.white(bitmap.size?.toString() || 'N/A')
          ]);
        });

        console.log(table.toString());
      } else {
        console.error(chalk.red('Error: Failed to retrieve bitmaps.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }

      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting bitmaps: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async documents() {
    try {
      await this.initialize();

      const contextId = this.getContextId();

      // Use the class property instead of calling parseInput
      const { featureArray } = this;

      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      const response = await this.api.get(`${contextsEndpoint}/${contextId}/documents`, {
        params: {
          features: featureArray
        }
      });

      if (response.data && response.data.status === 'success' && response.data.payload) {
        const documents = response.data.payload;

        if (documents.length === 0) {
          console.log(chalk.yellow('No documents found.'));
          return 0;
        }

        const table = this.createTable(['ID', 'Title', 'Type', 'Created']);

        documents.forEach(doc => {
          table.push([
            chalk.white(doc.id || 'N/A'),
            chalk.white(doc.content?.title || 'Untitled'),
            chalk.white(doc.content?.type || 'Unknown'),
            chalk.white(doc.created || 'N/A')
          ]);
        });

        console.log(table.toString());
      } else {
        console.error(chalk.red('Error: Failed to retrieve documents.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }

      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting documents: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async notes() {
    try {
      await this.initialize();

      const contextId = this.getContextId();

      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      const response = await this.api.get(`${contextsEndpoint}/${contextId}/documents`, {
        params: {
          features: ['data/abstraction/note']
        }
      });

      if (response.data && response.data.status === 'success' && response.data.payload) {
        const notes = response.data.payload;

        if (notes.length === 0) {
          console.log(chalk.yellow('No notes found.'));
          return 0;
        }

        const table = this.createTable(['ID', 'Title', 'Created']);

        notes.forEach(note => {
          table.push([
            chalk.white(note.id || 'N/A'),
            chalk.white(note.content?.title || 'Untitled'),
            chalk.white(note.created || 'N/A')
          ]);
        });

        console.log(table.toString());
      } else {
        console.error(chalk.red('Error: Failed to retrieve notes.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }

      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting notes: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async note(args) {
    const subCommand = args[0];
    const params = args.slice(1);

    if (subCommand === 'get') {
      return await this.noteGet(params);
    } else if (subCommand === 'add') {
      return await this.noteAdd(params);
    } else {
      console.error(chalk.red(`Unknown note command: ${subCommand}`));
      return 1;
    }
  }

  async noteGet(args) {
    try {
      await this.initialize();

      const idOrHash = args[0];

      if (!idOrHash) {
        console.error(chalk.red('Note ID or hash is required'));
        return 1;
      }

      const contextId = this.getContextId();

      let response;
      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;

      // Check if it's a hash or ID
      if (idOrHash.includes('/')) {
        // It's a hash
        response = await this.api.get(`${contextsEndpoint}/${contextId}/document/hash/${idOrHash}`);
      } else if (!isNaN(parseInt(idOrHash))) {
        // It's an ID
        response = await this.api.get(`${contextsEndpoint}/${contextId}/document/${idOrHash}`);
      } else {
        console.error(chalk.red('Invalid note ID or hash format'));
        return 1;
      }

      if (response.data && response.data.status === 'success' && response.data.payload) {
        const note = response.data.payload;

        console.log(chalk.cyan(`Title: ${note.content?.title || 'Untitled'}`));
        console.log(chalk.cyan(`ID: ${note.id}`));
        console.log(chalk.cyan(`Created: ${note.created || 'N/A'}`));
        console.log(chalk.cyan(`Updated: ${note.updated || 'N/A'}`));
        console.log('\n' + (note.content?.text || 'No content'));
      } else {
        console.error(chalk.red('Error: Failed to retrieve note.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }

      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting note: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async noteAdd(args) {
    try {
      await this.initialize();

      const contextId = this.getContextId();

      // Use the class property instead of calling parseInput
      const { featureArray } = this;

      let content = args.join(' ');

      if (!content) {
        console.error(chalk.red('Note content is required'));
        return 1;
      }

      // Add the note feature if not already present
      if (!featureArray.includes('data/abstraction/note')) {
        featureArray.push('data/abstraction/note');
      }

      const noteData = {
        content: {
          type: 'note',
          title: this.args.title || 'Note from CLI',
          text: content
        }
      };

      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      const response = await this.api.post(`${contextsEndpoint}/${contextId}/documents`, {
        documents: [noteData],
        features: featureArray
      });

      if (response.data && response.data.status === 'success' && response.data.payload) {
        console.log(chalk.green('Note added successfully'));

        if (response.data.payload.inserted && response.data.payload.inserted.length > 0) {
          const noteId = response.data.payload.inserted[0];
          console.log(chalk.green(`Note ID: ${noteId}`));
        }
      } else {
        console.error(chalk.red('Error: Failed to add note.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }

      return 0;
    } catch (err) {
      console.error(chalk.red(`Error adding note: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async tab(args) {
    const subCommand = args[0];
    const params = args.slice(1);

    if (subCommand === 'add') {
      return await this.tabAdd(params);
    } else if (subCommand === 'list') {
      return await this.tabList();
    } else {
      console.error(chalk.red(`Unknown tab command: ${subCommand}`));
      return 1;
    }
  }

  async tabAdd(args) {
    try {
      await this.initialize();

      const contextId = this.getContextId();

      // Use the class property instead of calling parseInput
      const { featureArray } = this;

      const url = args[0];

      if (!url) {
        console.error(chalk.red('URL is required'));
        return 1;
      }

      // Add the tab feature if not already present
      if (!featureArray.includes('data/abstraction/tab')) {
        featureArray.push('data/abstraction/tab');
      }

      const tabData = {
        content: {
          type: 'tab',
          title: this.args.title || new URL(url).hostname,
          url: url
        }
      };

      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      const response = await this.api.post(`${contextsEndpoint}/${contextId}/documents`, {
        documents: [tabData],
        features: featureArray
      });

      if (response.data && response.data.status === 'success' && response.data.payload) {
        console.log(chalk.green('Tab added successfully'));

        if (response.data.payload.inserted && response.data.payload.inserted.length > 0) {
          const tabId = response.data.payload.inserted[0];
          console.log(chalk.green(`Tab ID: ${tabId}`));
        }
      } else {
        console.error(chalk.red('Error: Failed to add tab.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }

      return 0;
    } catch (err) {
      console.error(chalk.red(`Error adding tab: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async tabList() {
    try {
      await this.initialize();

      const contextId = this.getContextId();

      // Use the contexts endpoint instead of context
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      const response = await this.api.get(`${contextsEndpoint}/${contextId}/documents`, {
        params: {
          features: ['data/abstraction/tab']
        }
      });

      if (response.data && response.data.status === 'success' && response.data.payload) {
        const tabs = response.data.payload;

        if (tabs.length === 0) {
          console.log(chalk.yellow('No tabs found.'));
          return 0;
        }

        const table = this.createTable(['ID', 'Title', 'URL']);

        tabs.forEach(tab => {
          table.push([
            chalk.white(tab.id || 'N/A'),
            chalk.white(tab.content?.title || 'Untitled'),
            chalk.white(tab.content?.url || 'N/A')
          ]);
        });

        console.log(table.toString());
      } else {
        console.error(chalk.red('Error: Failed to retrieve tabs.'));
        if (response.data && response.data.message) {
          console.error(chalk.red(`Reason: ${response.data.message}`));
        }
        return 1;
      }

      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting tabs: ${err.message}`));
      if (err.response && err.response.data && err.response.data.message) {
        console.error(chalk.red(`Server message: ${err.response.data.message}`));
      }
      return 1;
    }
  }

  async query(args) {
    try {
      await this.initialize();
      const contextId = this.getContextId();
      const contextsEndpoint = DEFAULT_CONFIG.endpoints.contexts;
      // Combine all positional arguments as the query string
      const queryString = args.join(' ');
      let featureArray = [];
      if (this.args.feature) {
        featureArray = [].concat(this.args.feature);
      }
      let filterArray = [];
      if (this.args.filter) {
        filterArray = [].concat(this.args.filter);
      }
      const response = await this.api.get(`${contextsEndpoint}/${contextId}/query`, {
        params: { query: queryString, featureArray, filterArray }
      });
      if (response.data && response.data.status === 'success' && response.data.payload) {
        const results = response.data.payload;
        if (results.length === 0) {
          console.log(chalk.yellow('No results found.'));
        } else {
          const table = this.createTable(['ID', 'Title', 'Created']);
          results.forEach(result => {
            table.push([
              chalk.white(result.id || 'N/A'),
              chalk.white(result.content && result.content.title ? result.content.title : 'Untitled'),
              chalk.white(result.created || '')
            ]);
          });
          console.log(table.toString());
        }
        return 0;
      } else {
        console.error(chalk.red('Error: ' + (response.data ? response.data.message : 'Query failed')));
        return 1;
      }
    } catch (err) {
      console.error(chalk.red('Error querying context: ' + err.message));
      return 1;
    }
  }

  /**
   * Get the current context ID or generate a default one based on machine ID
   * @returns {string} The context ID
   */
  getContextId() {
    // Check if we have a context ID in the config
    if (this.config.cli.context.id) {
      debug(`Using context ID from config: ${this.config.cli.context.id}`);
      return this.config.cli.context.id;
    }

    // Generate a context ID based on machine ID
    const machineId = this.getMachineId();
    const contextId = `cli-${machineId}`;

    // Save the generated ID to config
    this.config.cli.context.id = contextId;
    this.saveConfig();

    debug(`Generated new context ID: ${contextId}`);
    return contextId;
  }
}

export default ContextCLI;
