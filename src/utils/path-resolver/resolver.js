import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = dirname(dirname(dirname(__dirname)));

// Define path aliases configuration
const PATH_ALIASES = {
    '@/': {
        basePath: join(SERVER_ROOT, 'src'),
        prefix: '@/',
    },
    '@root/': {
        basePath: SERVER_ROOT,
        prefix: '@root/',
    },
    '@synapsd/': {
        basePath: join(SERVER_ROOT, 'src/services/synapsd/src'),
        prefix: '@synapsd/',
    },
};

export function resolve(specifier, context, nextResolve) {
    // Handle path aliases
    for (const [alias, config] of Object.entries(PATH_ALIASES)) {
        if (specifier.startsWith(alias)) {
            const extensionMatch = specifier.match(/\.[^.]+$/);
            let extension = extensionMatch ? extensionMatch[0] : '';
            const cleanSpecifier = specifier.replace(/\.[^.]+$/, '');
            const relativePath = cleanSpecifier.slice(config.prefix.length);
            
            // Build the full path
            let fullPath = resolvePath(config.basePath, relativePath);
            
            // If no extension provided, try to resolve it
            if (!extension) {
                // First try as a directory with index.js
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                    const indexPath = join(fullPath, 'index.js');
                    if (fs.existsSync(indexPath)) {
                        fullPath = indexPath;
                    } else {
                        extension = '.js';
                        fullPath += extension;
                    }
                }
                // Then try as a .js file
                else if (fs.existsSync(`${fullPath}.js`)) {
                    extension = '.js';
                    fullPath += extension;
                }
                // Default to .js if neither exists
                else {
                    extension = '.js';
                    fullPath += extension;
                }
            } else {
                fullPath += extension;
            }

            const newSpecifier = pathToFileURL(fullPath).href;
            return nextResolve(newSpecifier);
        }
    }
    
    return nextResolve(specifier);
}
