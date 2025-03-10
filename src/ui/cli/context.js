#!/usr/bin/env node

'use strict';

import ContextCLI from './lib/Context.js';

const cli = new ContextCLI();
cli.run().then(exitCode => {
  process.exit(exitCode);
}).catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
