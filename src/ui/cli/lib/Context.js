#!/usr/bin/env node

'use strict';

import chalk from 'chalk';
import BaseCLI from './Base.js';

// Import DEFAULT_CONFIG from BaseCLI
import { DEFAULT_CONFIG } from './Base.js';

class ContextCLI extends BaseCLI {
  constructor() {
    super();
    this.commandName = 'context';
  }

  async run() {

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

${chalk.bold('OPTIONS')}
  ${chalk.yellow('-h, --help')}               Show this help message
  ${chalk.yellow('-v, --version')}            Show version information
  ${chalk.yellow('-f, --feature <feature>')}  Specify document feature(s)
  ${chalk.yellow('-t, --tag <tag>')}          Add tag(s) to document
  ${chalk.yellow('--title <title>')}          Set document title
  ${chalk.yellow('--context <context>')}      Specify context URL
    `);
  }

  async list() {
    try {
      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
      const response = await this.api.get(contextEndpoint);

      if (response.data && response.data.data) {
        const contexts = response.data.data;

        if (contexts.length === 0) {
          console.log(chalk.yellow('No contexts found.'));
          return 0;
        }

        const table = this.createTable(['ID', 'URL', 'Workspace', 'Created']);

        contexts.forEach(context => {
          table.push([
            context.id,
            context.url,
            context.workspace || 'N/A',
            context.created || 'N/A'
          ]);
        });

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error listing contexts: ${err.message}`));
      return 1;
    }
  }

  async set(args) {
    try {
      const url = args[0];

      if (!url) {
        console.error(chalk.red('Context URL is required'));
        return 1;
      }

      // Check if the URL contains a workspace ID
      if (url.includes('://')) {
        const [workspaceId, path] = url.split('://');

        // First, switch to the workspace
        try {
          const contextId = this.config.cli.context.id;
          const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
          await this.api.put(`${contextEndpoint}/${contextId}/workspace`, {
            workspace: workspaceId,
            url: path
          });

          console.log(chalk.green(`Switched to workspace ${workspaceId} with path ${path}`));
          return 0;
        } catch (err) {
          console.error(chalk.red(`Error switching workspace: ${err.message}`));
          return 1;
        }
      } else {
        // Just update the URL path
        const contextId = this.config.cli.context.id;
        const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
        const response = await this.api.put(`${contextEndpoint}/${contextId}/url`, {
          url
        });

        if (response.data && response.data.data) {
          console.log(chalk.green(`Context URL set to: ${url}`));
        }
        return 0;
      }
    } catch (err) {
      console.error(chalk.red(`Error setting context URL: ${err.message}`));
      return 1;
    }
  }

  async switch(args) {
    try {
      const contextId = args[0];

      if (!contextId) {
        console.error(chalk.red('Context ID is required'));
        return 1;
      }

      // Get the context to verify it exists and get its details
      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
      const response = await this.api.get(`${contextEndpoint}/${contextId}`);

      if (response.data && response.data.data) {
        const context = response.data.data;

        // Update the CLI config to use this context
        this.config.cli.context.id = contextId;
        this.saveConfig();

        console.log(chalk.green(`Switched to context ${contextId} at ${context.workspace || 'unknown'}://${context.url}`));
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error switching context: ${err.message}`));
      return 1;
    }
  }

  async url() {
    try {
      const contextId = this.config.cli.context.id;

      if (!contextId) {
        console.error(chalk.red('No active context'));
        return 1;
      }

      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
      const response = await this.api.get(`${contextEndpoint}/${contextId}`);

      if (response.data && response.data.data) {
        const context = response.data.data;
        console.log(`${context.workspace || 'unknown'}://${context.url}`);
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting context URL: ${err.message}`));
      return 1;
    }
  }

  async id() {
    try {
      const contextId = this.config.cli.context.id;

      if (!contextId) {
        console.error(chalk.red('No active context'));
        return 1;
      }

      console.log(contextId);
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting context ID: ${err.message}`));
      return 1;
    }
  }

  async path() {
    try {
      const contextId = this.config.cli.context.id;

      if (!contextId) {
        console.error(chalk.red('No active context'));
        return 1;
      }

      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
      const response = await this.api.get(`${contextEndpoint}/${contextId}`);

      if (response.data && response.data.data) {
        const context = response.data.data;
        console.log(context.url);
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting context path: ${err.message}`));
      return 1;
    }
  }

  async bitmaps() {
    try {
      const contextId = this.config.cli.context.id;

      if (!contextId) {
        console.error(chalk.red('No active context'));
        return 1;
      }

      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
      const response = await this.api.get(`${contextEndpoint}/${contextId}/bitmaps`);

      if (response.data && response.data.data) {
        const bitmaps = response.data.data;

        if (bitmaps.length === 0) {
          console.log(chalk.yellow('No bitmaps found.'));
          return 0;
        }

        const table = this.createTable(['Key', 'Size']);

        bitmaps.forEach(bitmap => {
          table.push([
            bitmap.key,
            bitmap.size || 'N/A'
          ]);
        });

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting context bitmaps: ${err.message}`));
      return 1;
    }
  }

  async documents() {
    try {
      await this.initialize();

      const contextId = this.config.cli.context.id;

      if (!contextId) {
        console.error(chalk.red('No active context'));
        return 1;
      }

      // Use the class property instead of calling parseInput
      const { featureArray } = this;

      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
      const response = await this.api.get(`${contextEndpoint}/${contextId}/documents`, {
        params: {
          features: featureArray
        }
      });

      if (response.data && response.data.data) {
        const documents = response.data.data;

        if (documents.length === 0) {
          console.log(chalk.yellow('No documents found.'));
          return 0;
        }

        const table = this.createTable(['ID', 'Title', 'Type', 'Created']);

        documents.forEach(doc => {
          table.push([
            doc.id,
            doc.content?.title || 'Untitled',
            doc.content?.type || 'Unknown',
            doc.created || 'N/A'
          ]);
        });

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error listing documents: ${err.message}`));
      return 1;
    }
  }

  async notes() {
    try {
      const contextId = this.config.cli.context.id;

      if (!contextId) {
        console.error(chalk.red('No active context'));
        return 1;
      }

      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
      const response = await this.api.get(`${contextEndpoint}/${contextId}/documents`, {
        params: {
          features: ['data/abstraction/note']
        }
      });

      if (response.data && response.data.data) {
        const notes = response.data.data;

        if (notes.length === 0) {
          console.log(chalk.yellow('No notes found.'));
          return 0;
        }

        const table = this.createTable(['ID', 'Title', 'Created']);

        notes.forEach(note => {
          table.push([
            note.id,
            note.content?.title || 'Untitled',
            note.created || 'N/A'
          ]);
        });

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error listing notes: ${err.message}`));
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
      const idOrHash = args[0];

      if (!idOrHash) {
        console.error(chalk.red('Note ID or hash is required'));
        return 1;
      }

      const contextId = this.config.cli.context.id;

      if (!contextId) {
        console.error(chalk.red('No active context'));
        return 1;
      }

      let response;
      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;

      // Check if it's a hash or ID
      if (idOrHash.includes('/')) {
        // It's a hash
        response = await this.api.get(`${contextEndpoint}/${contextId}/document/hash/${idOrHash}`);
      } else if (!isNaN(parseInt(idOrHash))) {
        // It's an ID
        response = await this.api.get(`${contextEndpoint}/${contextId}/document/${idOrHash}`);
      } else {
        console.error(chalk.red('Invalid note ID or hash format'));
        return 1;
      }

      if (response.data && response.data.data) {
        const note = response.data.data;

        console.log(chalk.cyan(`Title: ${note.content?.title || 'Untitled'}`));
        console.log(chalk.cyan(`ID: ${note.id}`));
        console.log(chalk.cyan(`Created: ${note.created || 'N/A'}`));
        console.log(chalk.cyan(`Updated: ${note.updated || 'N/A'}`));
        console.log('\n' + (note.content?.text || 'No content'));
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting note: ${err.message}`));
      return 1;
    }
  }

  async noteAdd(args) {
    try {
      await this.initialize();

      const contextId = this.config.cli.context.id;

      if (!contextId) {
        console.error(chalk.red('No active context'));
        return 1;
      }

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

      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
      const response = await this.api.post(`${contextEndpoint}/${contextId}/documents`, {
        documents: [noteData],
        features: featureArray
      });

      if (response.data && response.data.data) {
        console.log(chalk.green('Note added successfully'));

        if (response.data.data.inserted && response.data.data.inserted.length > 0) {
          const noteId = response.data.data.inserted[0];
          console.log(chalk.green(`Note ID: ${noteId}`));
        }
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error adding note: ${err.message}`));
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

      const contextId = this.config.cli.context.id;

      if (!contextId) {
        console.error(chalk.red('No active context'));
        return 1;
      }

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

      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
      const response = await this.api.post(`${contextEndpoint}/${contextId}/documents`, {
        documents: [tabData],
        features: featureArray
      });

      if (response.data && response.data.data) {
        console.log(chalk.green('Tab added successfully'));

        if (response.data.data.inserted && response.data.data.inserted.length > 0) {
          const tabId = response.data.data.inserted[0];
          console.log(chalk.green(`Tab ID: ${tabId}`));
        }
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error adding tab: ${err.message}`));
      return 1;
    }
  }

  async tabList() {
    try {
      const contextId = this.config.cli.context.id;

      if (!contextId) {
        console.error(chalk.red('No active context'));
        return 1;
      }

      const contextEndpoint = DEFAULT_CONFIG.endpoints.context;
      const response = await this.api.get(`${contextEndpoint}/${contextId}/documents`, {
        params: {
          features: ['data/abstraction/tab']
        }
      });

      if (response.data && response.data.data) {
        const tabs = response.data.data;

        if (tabs.length === 0) {
          console.log(chalk.yellow('No tabs found.'));
          return 0;
        }

        const table = this.createTable(['ID', 'Title', 'URL']);

        tabs.forEach(tab => {
          table.push([
            tab.id,
            tab.content?.title || 'Untitled',
            tab.content?.url || 'N/A'
          ]);
        });

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error listing tabs: ${err.message}`));
      return 1;
    }
  }
}

export default ContextCLI;
