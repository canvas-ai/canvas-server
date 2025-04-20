#!/usr/bin/env node

import env from '../src/env.js';

console.log('Environment variables test:');
console.log('Process env CANVAS_ADMIN_RESET:', process.env.CANVAS_ADMIN_RESET);
console.log('Env module CANVAS_ADMIN_RESET:', env.CANVAS_ADMIN_RESET);
console.log('Process env CANVAS_ADMIN_EMAIL:', process.env.CANVAS_ADMIN_EMAIL);
console.log('Env module CANVAS_ADMIN_EMAIL:', env.CANVAS_ADMIN_EMAIL);
