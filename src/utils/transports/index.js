import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Construct __dirname equivalent for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generateAuthToken() {
  return {
    accessToken: crypto.randomBytes(32).toString('hex'),
    jwtSecret: crypto.randomBytes(64).toString('hex')
  };
}

async function setupTransportsConfig() {
  const projectRoot = path.resolve(__dirname, '../../../');
  const serverConfigDir = path.join(projectRoot, 'server', 'config');
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
    
    if (!config.auth?.accessToken || !config.auth?.jwtSecret) {
      const { accessToken, jwtSecret } = generateAuthToken();
      
      config.rest.auth = config.rest.auth || {};
      config.rest.auth.accessToken = accessToken;
      config.rest.auth.jwtSecret = jwtSecret;
      
      for (const transport of ['rest', 'ws']) {
        if (config[transport]) {
          config[transport].auth = {
            enabled: true,
            accessToken: config.rest.auth.accessToken,
            jwtSecret: config.rest.auth.jwtSecret
          };
        }
      }
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  } catch (error) {
    throw new Error(`Failed to update auth configuration: ${error.message}`);
  }
}

export default setupTransportsConfig;