#!/usr/bin/env node

'use strict';

import BaseCLI from './lib/BaseCLI.js';

// Create a single CLI instance that handles all modules
const cli = new BaseCLI();

// Run the CLI and handle exit codes
cli.run()
    .then((exitCode) => {
        process.exit(exitCode);
    })
    .catch((err) => {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    });
