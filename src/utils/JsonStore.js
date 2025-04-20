'use strict';

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import logger, { createDebug } from './log/index.js';

const debug = createDebug('json-store');

/**
 * JsonStore - Utility mixin for adding JSON import/export capabilities to manager classes
 * that use LMDB or other data stores but need JSON interoperability
 */
class JsonStore {
    /**
     * Export data to JSON format
     * @param {Object} data - Data to export
     * @param {string} dataType - Type of data being exported (for naming)
     * @param {string} [outputPath] - Optional path to save JSON file
     * @returns {Promise<Object>} Exported data with metadata
     */
    static async exportToJson(data, dataType, outputPath) {
        const exportData = {
            [dataType]: data,
            exportedAt: new Date().toISOString(),
        };

        if (outputPath) {
            try {
                await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
                debug(`Exported ${dataType} data to ${outputPath}`);
            } catch (error) {
                debug(`Error exporting ${dataType} data: ${error.message}`);
                throw new Error(`Failed to export ${dataType} data: ${error.message}`);
            }
        }

        return exportData;
    }

    /**
     * Import data from JSON format
     * @param {string|Object} input - JSON string, path to JSON file, or object
     * @param {string} dataType - Type of data being imported (for validation)
     * @returns {Promise<Object>} Parsed data object
     */
    static async importFromJson(input, dataType) {
        let importedData;

        if (typeof input === 'string') {
            // Check if input is a file path or JSON string
            if (input.endsWith('.json') && existsSync(input)) {
                const fileContent = await fs.readFile(input, 'utf8');
                importedData = JSON.parse(fileContent);
            } else {
                // Assume it's a JSON string
                importedData = JSON.parse(input);
            }
        } else if (typeof input === 'object') {
            importedData = input;
        } else {
            throw new Error(`Invalid input format for ${dataType} import`);
        }

        // Validate that the imported data contains the expected data type
        if (!importedData[dataType]) {
            throw new Error(`Invalid data format: missing ${dataType} property`);
        }

        return importedData;
    }

    /**
     * Create a directory for storing JSON exports if it doesn't exist
     * @param {string} dirPath - Directory path
     * @returns {Promise<void>}
     */
    static async ensureExportDirectory(dirPath) {
        if (!existsSync(dirPath)) {
            try {
                await fs.mkdir(dirPath, { recursive: true });
                debug(`Created export directory: ${dirPath}`);
            } catch (error) {
                debug(`Error creating export directory: ${error.message}`);
                throw new Error(`Failed to create export directory: ${error.message}`);
            }
        }
    }

    /**
     * Generate a default export path for a given data type
     * @param {string} baseDir - Base directory for exports
     * @param {string} dataType - Type of data being exported
     * @returns {string} Export file path
     */
    static getDefaultExportPath(baseDir, dataType) {
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        return path.join(baseDir, `${dataType}-${timestamp}.json`);
    }
}

export default JsonStore;
