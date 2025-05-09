'use strict';

// Includes
import debugInstance from 'debug';

/*
 * Temporary logger as per @RFC5424
 *    error: 0
 *    warn: 1
 *    info: 2
 *    verbose: 3
 *    debug: 4
 *    silly: 5
 * Logger needs to implement at least the 4 methods below
 */
// TODO: Replace logger with canvas-utils-logger
const debug = debugInstance('canvas:utils:common');
const logger = {};
logger.debug = debug;
logger.info = console.log;
logger.warn = console.log;
logger.error = console.error;

export default logger;
