#!/usr/bin/env node

'use strict';

import WorkspaceCLI from './lib/Workspace.js';

const cli = new WorkspaceCLI();
cli.run().then(exitCode => {
  process.exit(exitCode);
}).catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
