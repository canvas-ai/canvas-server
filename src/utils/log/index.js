/**
 * Single Logger Module for Canvas
 */

import winston from 'winston';
import path from 'path';
import env from '../../env.js';
import debugMessage from 'debug';

// Create debug namespace for the application
const createDebug = (namespace) => debugMessage(`canvas:${namespace}`);

// Default log file path
const DEFAULT_LOG_FILE = path.join(env.CANVAS_SERVER_VAR, 'log', 'canvas-server.log');

/**
 * Create a Winston logger instance with the specified configuration
 */

function createLogger(options = {}) {
    const { level = env.LOG_LEVEL || 'info', filename = DEFAULT_LOG_FILE, console = true, format = 'default' } = options;

    // Define log formats
    const formats = {
        default: winston.format.combine(
            winston.format.timestamp({
                format: 'YYYYMMDD-HHmmss',
            }),
            winston.format.printf(({ level, message, timestamp }) => {
                return `${timestamp}|${level}|${message}`;
            }),
        ),
        json: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        // Add more formats as needed
    };

    // Configure transports
    const transports = [
        new winston.transports.File({
            filename,
            format: formats[format] || formats.default,
        }),
    ];

    // Add console transport if enabled
    if (console) {
        transports.push(
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
            }),
        );
    }

    // Create and return the logger
    return winston.createLogger({
        level,
        format: formats[format] || formats.default,
        transports,
    });
}

// Create the default application logger
const logger = createLogger();

// Export the logger and utilities
export { logger, createLogger, createDebug };

export default logger;
