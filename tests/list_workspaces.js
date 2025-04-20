#!/usr/bin/env node

// Script to list all workspaces in the index

import env from '../src/env.js';
import Jim from '../src/utils/jim/index.js';

async function main() {
    console.log('Listing workspaces in the index...');

    const jim = new Jim({
        rootPath: env.CANVAS_SERVER_DB,
    });

    // Get workspaces from the index
    const workspaces = jim.get('workspaces', []);

    console.log(`Found ${workspaces.length} workspaces in index`);
    workspaces.forEach((ws, i) => {
        console.log(`[${i}] ID: ${ws.id}, Path: ${ws.rootPath}, Status: ${ws.status}`);
    });
}

main().catch(console.error);
