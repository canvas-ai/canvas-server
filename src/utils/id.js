import { ulid } from 'ulid';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a UUID
 * @param {string} [prefix] - Prefix for the UUID
 * @param {number} [length] - Length of the UUID
 * @returns {string} UUID
 */
function generateUUID(prefix = '', length = 12, delimiter = '-') {
    const id = uuidv4().replace(/-/g, '').slice(0, length);
    return (prefix ? `${prefix}${delimiter}${id}` : id);
}

/**
 * Generate a ULID
 * @param {string} [prefix] - Prefix for the ULID
 * @param {number} [length] - Length of the ULID
 * @returns {string} ULID
 */
function generateULID(prefix = '', length = 12, delimiter = '-') {
    const id = ulid().replace(/-/g, '').slice(0, length).toLowerCase();
    return (prefix ? `${prefix}${delimiter}${id}` : id);
}

/**
 * Generate an index key
 * @param {string} module - Module name
 * @param {string} key - Key name
 * @param {string} [delimiter] - Delimiter for the index key
 * @returns {string} Index key
 */
function generateIndexKey(module, key, delimiter = '/') {
    return `${module}${delimiter}${key}`;
}

export {
    generateULID,
    generateUUID,
    generateIndexKey
};
