import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import env from '../env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generateJwtSecret() {
  return crypto.randomBytes(64).toString('hex');
}

async function setupTransportsConfig() {
  const serverConfigDir = path.join(env.CANVAS_SERVER_CONFIG);
  const exampleConfigPath = path.join(serverConfigDir, 'example-canvas-server.transports.json');
  const configPath = path.join(serverConfigDir, 'canvas-server.transports.json');

  if (!fs.existsSync(configPath)) {
    try {
      const exampleConfig = JSON.parse(fs.readFileSync(exampleConfigPath, 'utf8'));
      fs.writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2));
    } catch (error) {
      throw new Error(`Failed to create transports config: ${error.message}`);
    }
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Only generate and set JWT secret if not already present
    if (!config.rest?.auth?.jwtSecret) {
      const jwtSecret = generateJwtSecret();

      // Initialize auth config if not present
      config.rest = config.rest || {};
      config.rest.auth = config.rest.auth || {};
      config.rest.auth.jwtSecret = jwtSecret;

      // Apply same JWT secret to both REST and WebSocket transports
      for (const transport of ['rest', 'ws']) {
        if (config[transport]) {
          config[transport].auth = {
            enabled: config.rest.auth.enabled || true,
            jwtLifetime: config.rest.auth.jwtLifetime || '48h',
            jwtSecret: config.rest.auth.jwtSecret
          };
        }
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to update auth configuration: ${error.message}`);
  }
}

export default setupTransportsConfig;