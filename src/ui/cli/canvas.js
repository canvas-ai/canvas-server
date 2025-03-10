#!/usr/bin/env node

'use strict';

import CanvasCLI from './lib/Canvas.js';

const cli = new CanvasCLI();
cli.run().then(exitCode => {
  process.exit(exitCode);
}).catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
