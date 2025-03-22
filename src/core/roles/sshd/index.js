// SSH Server Role for Canvas
// Provides SSH access to user directories using canvas-server authentication

import { createServer } from 'ssh2';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import { timingSafeEqual } from 'crypto';
import { spawn } from 'child_process';
import { createDebug } from '@/utils/log/index.js';
const debug = createDebug('canvas:role:sshd');

// Default SSH server port
const SSH_PORT = 8003;

class SSHServerRole {
  #server = null;
  #authService = null;
  #userManager = null;
  #hostKeys = [];
  #serverOptions = {};
  #running = false;

  constructor(options = {}) {
    this.#serverOptions = {
      port: options.port || SSH_PORT,
      hostKeyPath: options.hostKeyPath
    };
  }

  /**
   * Initialize the SSH server role
   * @param {Object} server - Canvas server instance
   */
  async initialize(server) {
    debug('Initializing SSH server role');
    this.#authService = server.services.get('auth');
    this.#userManager = server.userManager;

    if (!this.#authService) {
      throw new Error('Auth service is required for SSH server role');
    }

    if (!this.#userManager) {
      throw new Error('User manager is required for SSH server role');
    }

    // Load or generate host keys
    await this.#loadHostKeys();

    debug('SSH server role initialized');
    return true;
  }

  /**
   * Start the SSH server
   */
  async start() {
    if (this.#running) {
      debug('SSH server already running');
      return true;
    }

    debug(`Starting SSH server on port ${this.#serverOptions.port}`);

    this.#server = createServer({
      hostKeys: this.#hostKeys
    }, this.#handleClient.bind(this));

    return new Promise((resolve, reject) => {
      this.#server.listen(this.#serverOptions.port, '0.0.0.0', () => {
        debug(`SSH server listening on port ${this.#serverOptions.port}`);
        this.#running = true;
        resolve(true);
      });

      this.#server.on('error', (err) => {
        debug(`SSH server error: ${err.message}`);
        this.#running = false;
        reject(err);
      });
    });
  }

  /**
   * Stop the SSH server
   */
  async stop() {
    if (!this.#running || !this.#server) {
      debug('SSH server not running');
      return true;
    }

    return new Promise((resolve) => {
      this.#server.close(() => {
        debug('SSH server stopped');
        this.#running = false;
        this.#server = null;
        resolve(true);
      });
    });
  }

  /**
   * Load or generate SSH host keys
   */
  async #loadHostKeys() {
    const keysDir = this.#serverOptions.hostKeyPath || path.join(process.env.CANVAS_SERVER_CONFIG, 'ssh');

    try {
      // Ensure the keys directory exists
      await fs.mkdir(keysDir, { recursive: true });

      const rsa_key_path = path.join(keysDir, 'ssh_host_rsa_key');

      try {
        // Try to load existing keys
        this.#hostKeys.push(readFileSync(rsa_key_path));
        debug('Loaded existing SSH host key');
      } catch (err) {
        // Generate new key if none exists
        debug('No existing SSH host key found, generating new key...');

        // Use ssh-keygen to generate a new host key if on Linux
        try {
          const { spawn } = await import('child_process');
          const keygen = spawn('ssh-keygen', [
            '-t', 'rsa',
            '-f', rsa_key_path,
            '-N', '',
            '-C', `canvas-server-${new Date().toISOString()}`
          ]);

          await new Promise((resolve, reject) => {
            keygen.on('exit', (code) => {
              if (code === 0) {
                debug('Generated new SSH host key');
                try {
                  this.#hostKeys.push(readFileSync(rsa_key_path));
                  resolve();
                } catch (err) {
                  reject(new Error('Failed to read generated host key'));
                }
              } else {
                reject(new Error(`ssh-keygen exited with code ${code}`));
              }
            });
          });
        } catch (err) {
          debug(`Failed to generate SSH host key: ${err.message}`);
          throw new Error('Failed to load or generate SSH host keys');
        }
      }
    } catch (err) {
      debug(`Error loading SSH host keys: ${err.message}`);
      throw err;
    }
  }

  /**
   * Handle new SSH client connection
   * @param {Object} client - SSH client connection
   */
  #handleClient(client) {
    debug('New SSH client connection');

    client.on('authentication', async (ctx) => {
      try {
        // Get the username from the auth context
        const email = ctx.username;
        debug(`Authentication attempt for user: ${email}`);

        // Check if user exists
        const user = await this.#userManager.getUserByEmail(email);
        if (!user) {
          debug(`User not found: ${email}`);
          return ctx.reject();
        }

        let authenticated = false;

        // Handle different authentication methods
        switch (ctx.method) {
          case 'password':
            // Authenticate using password
            try {
              const isValid = await this.#authService.verifyPassword(user.id, ctx.password);
              if (isValid) {
                authenticated = true;
                debug(`Password authentication successful for user: ${email}`);
              } else {
                debug(`Invalid password for user: ${email}`);
              }
            } catch (err) {
              debug(`Password authentication error: ${err.message}`);
            }
            break;

          case 'publickey':
            // Authenticate using public key
            try {
              // TODO: Implement public key authentication by checking user's stored SSH keys
              // For now, always reject publickey auth
              debug('Public key authentication not implemented yet');
            } catch (err) {
              debug(`Public key authentication error: ${err.message}`);
            }
            break;

          default:
            debug(`Unsupported authentication method: ${ctx.method}`);
            return ctx.reject();
        }

        if (authenticated) {
          // Store user information in client object for later use
          client.canvasUser = user;
          ctx.accept();
        } else {
          ctx.reject();
        }
      } catch (err) {
        debug(`Authentication error: ${err.message}`);
        ctx.reject();
      }
    });

    client.on('ready', () => {
      debug(`Client authenticated: ${client.canvasUser.email}`);

      client.on('session', (accept, reject) => {
        const session = accept();

        // Setup shell handler
        session.on('shell', (accept, reject) => {
          const stream = accept();
          this.#setupShell(stream, client.canvasUser);
        });

        // Setup exec handler (for non-interactive commands)
        session.on('exec', (accept, reject, info) => {
          const stream = accept();
          this.#executeCommand(stream, client.canvasUser, info.command);
        });

        // Setup SFTP handler
        session.on('sftp', (accept, reject) => {
          const sftpStream = accept();
          this.#setupSFTP(sftpStream, client.canvasUser);
        });
      });
    });

    client.on('error', (err) => {
      debug(`SSH client error: ${err.message}`);
    });

    client.on('end', () => {
      debug('SSH client disconnected');
    });
  }

  /**
   * Setup an interactive shell for user
   * @param {Object} stream - SSH stream
   * @param {Object} user - Canvas user object
   */
  async #setupShell(stream, user) {
    debug(`Setting up shell for user: ${user.email}`);

    // Get user home directory path
    const homePath = user.homePath;
    debug(`User home directory: ${homePath}`);

    // Check if we're on Linux
    const isLinux = process.platform === 'linux';

    if (isLinux) {
      try {
        // Create a chroot shell using bash
        const shell = spawn('bash', [], {
          cwd: homePath,
          env: {
            HOME: homePath,
            PATH: process.env.PATH,
            TERM: 'xterm-color',
            USER: user.email,
            SHELL: '/bin/bash'
          }
        });

        // Connect stdio to SSH stream
        shell.stdout.pipe(stream);
        shell.stderr.pipe(stream.stderr);
        stream.pipe(shell.stdin);

        // Handle exit
        shell.on('exit', (code, signal) => {
          debug(`Shell exited with code ${code} and signal ${signal}`);
          stream.exit(code || 0);
          stream.end();
        });

        // Handle errors
        shell.on('error', (err) => {
          debug(`Shell error: ${err.message}`);
          stream.stderr.write(`Error: ${err.message}\r\n`);
          stream.exit(1);
          stream.end();
        });

        // Display welcome message
        stream.write(`Welcome to Canvas Shell!\r\n`);
        stream.write(`You are in your Canvas workspace: ${homePath}\r\n\r\n`);
      } catch (err) {
        debug(`Error setting up shell: ${err.message}`);
        stream.stderr.write(`Failed to start shell: ${err.message}\r\n`);
        stream.exit(1);
        stream.end();
      }
    } else {
      // Not on Linux, can't chroot - implement a custom shell or fallback
      stream.write(`Welcome to Canvas Shell (Limited Mode)!\r\n`);
      stream.write(`You are in your Canvas workspace: ${homePath}\r\n`);
      stream.write(`Note: Full shell functionality is only available on Linux.\r\n\r\n`);

      // TODO: Implement a custom Node.js shell
      // For now, just exit cleanly
      stream.exit(0);
      stream.end();
    }
  }

  /**
   * Execute a specific command for user
   * @param {Object} stream - SSH stream
   * @param {Object} user - Canvas user object
   * @param {string} command - Command to execute
   */
  async #executeCommand(stream, user, command) {
    debug(`Executing command for user ${user.email}: ${command}`);

    // Get user home directory path
    const homePath = user.homePath;

    try {
      // Execute command in bash
      const proc = spawn('bash', ['-c', command], {
        cwd: homePath,
        env: {
          HOME: homePath,
          PATH: process.env.PATH,
          TERM: 'xterm-color',
          USER: user.email
        }
      });

      // Connect stdio to SSH stream
      proc.stdout.pipe(stream);
      proc.stderr.pipe(stream.stderr);
      stream.pipe(proc.stdin);

      // Handle exit
      proc.on('exit', (code, signal) => {
        debug(`Command exited with code ${code} and signal ${signal}`);
        stream.exit(code || 0);
        stream.end();
      });

      // Handle errors
      proc.on('error', (err) => {
        debug(`Command error: ${err.message}`);
        stream.stderr.write(`Error: ${err.message}\r\n`);
        stream.exit(1);
        stream.end();
      });
    } catch (err) {
      debug(`Error executing command: ${err.message}`);
      stream.stderr.write(`Failed to execute command: ${err.message}\r\n`);
      stream.exit(1);
      stream.end();
    }
  }

  /**
   * Setup SFTP for user
   * @param {Object} sftpStream - SSH SFTP stream
   * @param {Object} user - Canvas user object
   */
  #setupSFTP(sftpStream, user) {
    debug(`Setting up SFTP for user: ${user.email}`);

    // Get user home directory path
    const homePath = user.homePath;

    // SFTP constants from ssh2 library
    const STATUS_CODE = {
      OK: 0,
      EOF: 1,
      NO_SUCH_FILE: 2,
      PERMISSION_DENIED: 3,
      FAILURE: 4,
      BAD_MESSAGE: 5,
      NO_CONNECTION: 6,
      CONNECTION_LOST: 7,
      OP_UNSUPPORTED: 8
    };

    const OPEN_MODE = {
      READ: 0x00000001,
      WRITE: 0x00000002,
      APPEND: 0x00000004,
      CREATE: 0x00000008,
      TRUNCATE: 0x00000010,
      EXCL: 0x00000020
    };

    // Map to track open files
    const openFiles = new Map();
    let handleCount = 0;

    // Handle SFTP commands
    sftpStream.on('OPEN', async (reqid, filename, flags, attrs) => {
      try {
        // Resolve the path to make sure it's within user's home directory
        const resolvedPath = path.resolve(homePath, filename.replace(/^\//, ''));

        // Security check - ensure the path is within user's home directory
        if (!resolvedPath.startsWith(homePath)) {
          debug(`SFTP security violation: ${filename} resolves outside of home directory`);
          return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
        }

        debug(`SFTP OPEN: ${resolvedPath}`);

        // Create handle for the file
        const handle = Buffer.alloc(4);
        handle.writeUInt32BE(handleCount, 0);

        // Store file info in our map
        openFiles.set(handleCount, {
          path: resolvedPath,
          flags,
          // We'll create a real file handle when needed
          fd: null
        });

        handleCount++;
        sftpStream.handle(reqid, handle);
      } catch (err) {
        debug(`SFTP OPEN error: ${err.message}`);
        sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }
    });

    // Implement other SFTP handlers (CLOSE, READ, WRITE, STAT, etc.)
    // This is a simplified implementation - a full SFTP server would need to
    // implement all the required SFTP commands

    sftpStream.on('CLOSE', async (reqid, handle) => {
      try {
        if (handle.length !== 4) {
          return sftpStream.status(reqid, STATUS_CODE.FAILURE);
        }

        const handleId = handle.readUInt32BE(0);
        const fileInfo = openFiles.get(handleId);

        if (!fileInfo) {
          return sftpStream.status(reqid, STATUS_CODE.FAILURE);
        }

        debug(`SFTP CLOSE: ${fileInfo.path}`);

        // Close file if it was opened
        if (fileInfo.fd !== null) {
          await fs.close(fileInfo.fd);
        }

        // Remove from our open files map
        openFiles.delete(handleId);

        sftpStream.status(reqid, STATUS_CODE.OK);
      } catch (err) {
        debug(`SFTP CLOSE error: ${err.message}`);
        sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }
    });

    // Additional SFTP handlers would be implemented here
    // For a complete implementation, all SFTP packet types should be handled
  }
}

export default SSHServerRole;