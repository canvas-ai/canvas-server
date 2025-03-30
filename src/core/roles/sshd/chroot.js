/**
 * Chroot Utility for Canvas SSH Server
 *
 * This module handles the chroot functionality for the SSH server role.
 * It requires Linux with proper capabilities to perform chroot operations.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createDebug } from '@/utils/log/index.js';
const debug = createDebug('canvas:role:sshd:chroot');

/**
 * Check if the current process has the necessary capabilities for chroot
 * @returns {Promise<boolean>} - Whether the process can chroot
 */
export async function canChroot() {
  // Check if we're on Linux
  if (process.platform !== 'linux') {
    debug('Not running on Linux, chroot unavailable');
    return false;
  }

  try {
    // Check if we have CAP_SYS_CHROOT capability
    // This requires the 'libcap2-bin' package to be installed
    const capsh = spawn('capsh', ['--print']);

    let output = '';
    capsh.stdout.on('data', (data) => {
      output += data.toString();
    });

    return new Promise((resolve) => {
      capsh.on('exit', (code) => {
        if (code !== 0) {
          debug('Failed to check capabilities');
          resolve(false);
          return;
        }

        // Check if we have the necessary capability
        const hasCapability = output.includes('cap_sys_chroot') || process.getuid() === 0;
        debug(`Chroot capability: ${hasCapability}`);
        resolve(hasCapability);
      });
    });
  } catch (err) {
    debug(`Error checking chroot capability: ${err.message}`);
    return false;
  }
}

/**
 * Setup a chroot jail for a user
 * @param {string} userHome - Path to user's home directory
 * @returns {Promise<boolean>} - Whether the setup was successful
 */
export async function setupChrootJail(userHome) {
  debug(`Setting up chroot jail for ${userHome}`);

  // Check if we can chroot
  if (!(await canChroot())) {
    debug('Cannot chroot, skipping jail setup');
    return false;
  }

  try {
    // Create essential directories
    const dirs = [
      'bin', 'lib', 'lib64', 'usr/bin', 'usr/lib', 'etc', 'dev', 'tmp'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(userHome, dir), { recursive: true });
      debug(`Created directory: ${path.join(userHome, dir)}`);
    }

    // Make tmp writable
    await fs.chmod(path.join(userHome, 'tmp'), 0o1777);

    // Copy essential binaries
    const binaries = [
      '/bin/bash', '/bin/sh', '/bin/ls', '/bin/mkdir', '/bin/rm', '/bin/cp',
      '/bin/mv', '/bin/cat', '/bin/grep', '/bin/touch', '/bin/chmod',
      '/usr/bin/vi', '/usr/bin/nano'
    ];

    for (const binary of binaries) {
      if (existsSync(binary)) {
        const destPath = path.join(userHome, binary);
        const destDir = path.dirname(destPath);

        await fs.mkdir(destDir, { recursive: true });
        await fs.copyFile(binary, destPath);
        await fs.chmod(destPath, 0o755);
        debug(`Copied binary: ${binary} to ${destPath}`);
      }
    }

    // Copy essential libraries
    await copyLibraries(userHome, binaries);

    // Create /dev/null and other special files
    await createDeviceFiles(userHome);

    // Create basic /etc files
    await createEtcFiles(userHome);

    debug('Chroot jail setup complete');
    return true;
  } catch (err) {
    debug(`Error setting up chroot jail: ${err.message}`);
    return false;
  }
}

/**
 * Copy required libraries for binaries
 * @param {string} chrootPath - Path to chroot directory
 * @param {string[]} binaries - List of binaries to copy libraries for
 */
async function copyLibraries(chrootPath, binaries) {
  debug(`Copying libraries for binaries to ${chrootPath}`);

  try {
    // Use ldd to find required libraries
    const ldd = spawn('ldd', binaries);

    let output = '';
    ldd.stdout.on('data', (data) => {
      output += data.toString();
    });

    await new Promise((resolve) => {
      ldd.on('exit', async () => {
        const libraries = new Set();

        // Parse ldd output to get library paths
        const libraryMatches = output.matchAll(/=>\s+(\S+)\s+\(/g);
        for (const match of libraryMatches) {
          if (match[1]) libraries.add(match[1]);
        }

        // Add libnss libraries for name resolution
        const libnssLibs = [
          '/lib/x86_64-linux-gnu/libnss_files.so.2',
          '/lib/x86_64-linux-gnu/libnss_dns.so.2'
        ];

        for (const lib of libnssLibs) {
          if (existsSync(lib)) libraries.add(lib);
        }

        // Copy libraries to chroot
        for (const lib of libraries) {
          try {
            const destPath = path.join(chrootPath, lib);
            const destDir = path.dirname(destPath);

            await fs.mkdir(destDir, { recursive: true });
            await fs.copyFile(lib, destPath);
            debug(`Copied library: ${lib} to ${destPath}`);
          } catch (err) {
            debug(`Failed to copy library ${lib}: ${err.message}`);
          }
        }

        // Handle ld-linux dynamic linker
        const ldLinuxPaths = [
          '/lib64/ld-linux-x86-64.so.2',
          '/lib/ld-linux-x86-64.so.2'
        ];

        for (const ldPath of ldLinuxPaths) {
          if (existsSync(ldPath)) {
            const destPath = path.join(chrootPath, ldPath);
            const destDir = path.dirname(destPath);

            await fs.mkdir(destDir, { recursive: true });
            await fs.copyFile(ldPath, destPath);
            debug(`Copied dynamic linker: ${ldPath} to ${destPath}`);
          }
        }

        resolve();
      });
    });
  } catch (err) {
    debug(`Error copying libraries: ${err.message}`);
  }
}

/**
 * Create device files in chroot
 * @param {string} chrootPath - Path to chroot directory
 */
async function createDeviceFiles(chrootPath) {
  debug(`Creating device files in ${chrootPath}`);

  // We can't create device files directly in Node.js
  // This requires using mknod with root privileges
  // Instead we'll create a script to do this and suggest running it as root

  const scriptPath = path.join(chrootPath, 'setup_devices.sh');
  const scriptContent = `#!/bin/bash
# This script must be run as root to create device files

# Check if we're root
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root"
   exit 1
fi

# Create device files
mknod -m 666 ${chrootPath}/dev/null c 1 3
mknod -m 666 ${chrootPath}/dev/zero c 1 5
mknod -m 666 ${chrootPath}/dev/tty c 5 0
mknod -m 666 ${chrootPath}/dev/random c 1 8
mknod -m 666 ${chrootPath}/dev/urandom c 1 9

echo "Device files created successfully"
`;

  try {
    await fs.writeFile(scriptPath, scriptContent);
    await fs.chmod(scriptPath, 0o755);

    debug(`Created device setup script at ${scriptPath}`);
    debug('Run this script as root to create device files');
  } catch (err) {
    debug(`Error creating device setup script: ${err.message}`);
  }
}

/**
 * Create basic /etc files in chroot
 * @param {string} chrootPath - Path to chroot directory
 */
async function createEtcFiles(chrootPath) {
  debug(`Creating /etc files in ${chrootPath}`);

  const etcFiles = {
    'passwd': `root:x:0:0:root:/root:/bin/bash
nobody:x:65534:65534:nobody:/:/bin/false
canvas:x:1000:1000:Canvas User:/:/bin/bash
`,
    'group': `root:x:0:
nobody:x:65534:
canvas:x:1000:
`,
    'nsswitch.conf': `passwd: files
shadow: files
group:  files
hosts:  files dns
`,
    'hosts': `127.0.0.1 localhost
::1       localhost
`
  };

  try {
    for (const [file, content] of Object.entries(etcFiles)) {
      const filePath = path.join(chrootPath, 'etc', file);
      await fs.writeFile(filePath, content);
      debug(`Created ${filePath}`);
    }
  } catch (err) {
    debug(`Error creating /etc files: ${err.message}`);
  }
}

/**
 * Create a chroot environment for all Canvas users
 * @param {Object} userManager - Canvas user manager
 * @returns {Promise<boolean>} - Whether the setup was successful
 */
export async function setupAllUsersChroot(userManager) {
  debug('Setting up chroot environments for all users');

  if (!(await canChroot())) {
    debug('Cannot chroot, skipping setup');
    return false;
  }

  try {
    // Get all users
    const users = await userManager.listUsers();

    for (const user of users) {
      debug(`Setting up chroot for user: ${user.email}`);
      await setupChrootJail(user.homePath);
    }

    debug('All user chroot environments set up');
    return true;
  } catch (err) {
    debug(`Error setting up user chroot environments: ${err.message}`);
    return false;
  }
}

/**
 * Execute command in chroot environment
 * @param {string} chrootPath - Path to chroot directory
 * @param {string} command - Command to execute
 * @param {Object} options - Command options
 * @returns {Promise<Object>} - Process output
 */
export async function executeInChroot(chrootPath, command, options = {}) {
  debug(`Executing in chroot: ${command}`);

  if (!(await canChroot())) {
    throw new Error('Cannot chroot, operation not supported');
  }

  return new Promise((resolve, reject) => {
    // Use chroot command to execute in chroot environment
    const proc = spawn('chroot', [chrootPath, 'bash', '-c', command], {
      env: {
        PATH: '/bin:/usr/bin',
        HOME: '/',
        ...options.env
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('exit', (code) => {
      resolve({
        code,
        stdout,
        stderr
      });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}