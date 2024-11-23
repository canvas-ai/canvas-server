// Imports
import env from '../env.js';
import Config from '../utils/config/Config.js';

const CanvasConfig = new Config({
    userConfigDir: env.CANVAS_USER_CONFIG,
    serverConfigDir: env.CANVAS_SERVER_CONFIG,
    configPriority: 'user',
    versioning: false,
});

export default CanvasConfig;
