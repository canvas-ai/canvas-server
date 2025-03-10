#!/usr/bin/env node

'use strict';

import chalk from 'chalk';
import BaseCLI from './Base.js';

// Import DEFAULT_CONFIG from BaseCLI
import { DEFAULT_CONFIG } from './Base.js';

class WorkspaceCLI extends BaseCLI {
  constructor() {
    super();
    this.commandName = 'ws';
  }

  async run() {
    console.log(this)

    return 0;
  }

  printHelp() {
    console.log(`
${chalk.bold('USAGE')}
  ${chalk.cyan(this.commandName)} [options] [command]

${chalk.bold('COMMANDS')}
  ${chalk.yellow('list')}                     List all workspaces
  ${chalk.yellow('create <name>')}            Create a new workspace
  ${chalk.yellow('get <id>')}                 Get workspace details
  ${chalk.yellow('update <id>')}              Update workspace properties
  ${chalk.yellow('open <id>')}                Open a workspace
  ${chalk.yellow('close <id>')}               Close a workspace
  ${chalk.yellow('remove <id>')}              Remove a workspace

${chalk.bold('OPTIONS')}
  ${chalk.yellow('-h, --help')}               Show this help message
  ${chalk.yellow('-v, --version')}            Show version information
  ${chalk.yellow('--name <name>')}            Workspace name (for create/update)
  ${chalk.yellow('--description <desc>')}     Workspace description (for create/update)
  ${chalk.yellow('--color <color>')}          Workspace color (for create/update)
  ${chalk.yellow('--type <type>')}            Workspace type (for create/update)
    `);
  }

  async list() {
    try {
      const workspacesEndpoint = DEFAULT_CONFIG.endpoints.workspaces;
      const response = await this.api.get(workspacesEndpoint);

      if (response.data && response.data.data) {
        const workspaces = response.data.data;

        if (workspaces.length === 0) {
          console.log(chalk.yellow('No workspaces found.'));
          return 0;
        }

        const table = this.createTable(['ID', 'Name', 'Type', 'Color', 'Status']);

        workspaces.forEach(workspace => {
          const colorText = workspace.color ?
            chalk.hex(workspace.color)(workspace.name) :
            workspace.name;

          table.push([
            workspace.id,
            colorText,
            workspace.type || 'default',
            workspace.color || 'none',
            workspace.status || 'active'
          ]);
        });

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error listing workspaces: ${err.message}`));
      return 1;
    }
  }

  async create(args) {
    try {
      const name = this.args.name || args[0];

      if (!name) {
        console.error(chalk.red('Workspace name is required'));
        return 1;
      }

      const workspaceData = {
        name,
        description: this.args.description,
        color: this.args.color,
        type: this.args.type
      };

      const workspacesEndpoint = DEFAULT_CONFIG.endpoints.workspaces;
      const response = await this.api.post(workspacesEndpoint, workspaceData);

      if (response.data && response.data.data) {
        const workspace = response.data.data;
        console.log(chalk.green(`Workspace created successfully with ID: ${workspace.id}`));

        // Display the created workspace
        const table = this.createTable(['ID', 'Name', 'Type', 'Color', 'Status']);
        const colorText = workspace.color ?
          chalk.hex(workspace.color)(workspace.name) :
          workspace.name;

        table.push([
          workspace.id,
          colorText,
          workspace.type || 'default',
          workspace.color || 'none',
          workspace.status || 'active'
        ]);

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error creating workspace: ${err.message}`));
      return 1;
    }
  }

  async get(args) {
    try {
      const id = args[0];

      if (!id) {
        console.error(chalk.red('Workspace ID is required'));
        return 1;
      }

      const workspacesEndpoint = DEFAULT_CONFIG.endpoints.workspaces;
      const response = await this.api.get(`${workspacesEndpoint}/${id}`);

      if (response.data && response.data.data) {
        const workspace = response.data.data;

        const table = this.createTable(['Property', 'Value']);

        table.push(['ID', workspace.id]);
        table.push(['Name', workspace.color ?
          chalk.hex(workspace.color)(workspace.name) :
          workspace.name]);
        table.push(['Description', workspace.description || '']);
        table.push(['Type', workspace.type || 'default']);
        table.push(['Color', workspace.color || 'none']);
        table.push(['Status', workspace.status || 'active']);
        table.push(['Owner', workspace.owner || '']);
        table.push(['Created', workspace.created || '']);
        table.push(['Updated', workspace.updated || '']);

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error getting workspace: ${err.message}`));
      return 1;
    }
  }

  async update(args) {
    try {
      const id = args[0];

      if (!id) {
        console.error(chalk.red('Workspace ID is required'));
        return 1;
      }

      const updateData = {};

      if (this.args.name) updateData.name = this.args.name;
      if (this.args.description) updateData.description = this.args.description;
      if (this.args.color) updateData.color = this.args.color;
      if (this.args.type) updateData.type = this.args.type;
      if (this.args.status) updateData.status = this.args.status;

      if (Object.keys(updateData).length === 0) {
        console.error(chalk.red('No update parameters provided'));
        return 1;
      }

      const workspacesEndpoint = DEFAULT_CONFIG.endpoints.workspaces;
      const response = await this.api.patch(`${workspacesEndpoint}/${id}`, updateData);

      if (response.data && response.data.data) {
        const workspace = response.data.data;
        console.log(chalk.green(`Workspace updated successfully: ${workspace.id}`));

        // Display the updated workspace
        const table = this.createTable(['ID', 'Name', 'Type', 'Color', 'Status']);
        const colorText = workspace.color ?
          chalk.hex(workspace.color)(workspace.name) :
          workspace.name;

        table.push([
          workspace.id,
          colorText,
          workspace.type || 'default',
          workspace.color || 'none',
          workspace.status || 'active'
        ]);

        console.log(table.toString());
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error updating workspace: ${err.message}`));
      return 1;
    }
  }

  async open(args) {
    try {
      const id = args[0];

      if (!id) {
        console.error(chalk.red('Workspace ID is required'));
        return 1;
      }

      // First, get the workspace to verify it exists
      const workspacesEndpoint = DEFAULT_CONFIG.endpoints.workspaces;
      const getResponse = await this.api.get(`${workspacesEndpoint}/${id}`);

      if (getResponse.data && getResponse.data.data) {
        // Update the session to use this workspace
        const sessionsEndpoint = DEFAULT_CONFIG.endpoints.sessions;
        const response = await this.api.put(`${sessionsEndpoint}/${this.config.cli.session.id}/workspace`, {
          workspace: id
        });

        if (response.data && response.data.data) {
          console.log(chalk.green(`Workspace ${id} opened successfully`));
        }
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error opening workspace: ${err.message}`));
      return 1;
    }
  }

  async close(args) {
    try {
      const id = args[0];

      if (!id) {
        console.error(chalk.red('Workspace ID is required'));
        return 1;
      }

      // Close the workspace by setting the session's workspace to null
      const sessionsEndpoint = DEFAULT_CONFIG.endpoints.sessions;
      const response = await this.api.put(`${sessionsEndpoint}/${this.config.cli.session.id}/workspace`, {
        workspace: null
      });

      if (response.data && response.data.data) {
        console.log(chalk.green(`Workspace ${id} closed successfully`));
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error closing workspace: ${err.message}`));
      return 1;
    }
  }

  async remove(args) {
    try {
      const id = args[0];

      if (!id) {
        console.error(chalk.red('Workspace ID is required'));
        return 1;
      }

      const workspacesEndpoint = DEFAULT_CONFIG.endpoints.workspaces;
      const response = await this.api.delete(`${workspacesEndpoint}/${id}`);

      if (response.data && response.data.data && response.data.data.success) {
        console.log(chalk.green(`Workspace ${id} removed successfully`));
      }
      return 0;
    } catch (err) {
      console.error(chalk.red(`Error removing workspace: ${err.message}`));
      return 1;
    }
  }
}

export default WorkspaceCLI;
