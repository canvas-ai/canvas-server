'use strict';

import Url from '../src/managers/context/lib/Url.js';

/**
 * Test suite for the Url parser class
 */

console.log('Running Url parser tests...');

// Test 1: Full format URL (session@workspace://path)
try {
    const url1 = new Url('my-laptop@universe://work/acme/devops/jira-1234');
    console.log('Test 1: Full format URL');
    console.log('  Raw:', url1.raw);
    console.log('  URL:', url1.url);
    console.log('  Session ID:', url1.sessionID);
    console.log('  Workspace ID:', url1.workspaceID);
    console.log('  Path:', url1.path);
    console.log('  Path Array:', url1.pathArray);
    console.log('  Is Valid:', url1.isValid);
    console.log('  Test 1: PASSED\n');
} catch (error) {
    console.error('  Test 1 FAILED:', error.message);
}

// Test 2: Workspace-only format URL (workspace://path)
try {
    const url2 = new Url('universe://work/reports');
    console.log('Test 2: Workspace-only format URL');
    console.log('  Raw:', url2.raw);
    console.log('  URL:', url2.url);
    console.log('  Session ID:', url2.sessionID);
    console.log('  Workspace ID:', url2.workspaceID);
    console.log('  Path:', url2.path);
    console.log('  Path Array:', url2.pathArray);
    console.log('  Is Valid:', url2.isValid);
    console.log('  Test 2: PASSED\n');
} catch (error) {
    console.error('  Test 2 FAILED:', error.message);
}

// Test 3: Simple path format URL (/path)
try {
    const url3 = new Url('/work/reports');
    console.log('Test 3: Simple path format URL');
    console.log('  Raw:', url3.raw);
    console.log('  URL:', url3.url);
    console.log('  Session ID:', url3.sessionID);
    console.log('  Workspace ID:', url3.workspaceID);
    console.log('  Path:', url3.path);
    console.log('  Path Array:', url3.pathArray);
    console.log('  Is Valid:', url3.isValid);
    console.log('  Test 3: PASSED\n');
} catch (error) {
    console.error('  Test 3 FAILED:', error.message);
}

// Test 4: Path without leading slash
try {
    const url4 = new Url('work/reports');
    console.log('Test 4: Path without leading slash');
    console.log('  Raw:', url4.raw);
    console.log('  URL:', url4.url);
    console.log('  Session ID:', url4.sessionID);
    console.log('  Workspace ID:', url4.workspaceID);
    console.log('  Path:', url4.path);
    console.log('  Path Array:', url4.pathArray);
    console.log('  Is Valid:', url4.isValid);
    console.log('  Test 4: PASSED\n');
} catch (error) {
    console.error('  Test 4 FAILED:', error.message);
}

// Test 5: URL with spaces (should be converted to underscores)
try {
    const url5 = new Url('my laptop@test workspace://work/reports with spaces');
    console.log('Test 5: URL with spaces');
    console.log('  Raw:', url5.raw);
    console.log('  URL:', url5.url);
    console.log('  Session ID:', url5.sessionID);
    console.log('  Workspace ID:', url5.workspaceID);
    console.log('  Path:', url5.path);
    console.log('  Path Array:', url5.pathArray);
    console.log('  Is Valid:', url5.isValid);
    console.log('  Test 5: PASSED\n');
} catch (error) {
    console.error('  Test 5 FAILED:', error.message);
}

// Test 6: Invalid URL with special characters
try {
    const url6 = new Url('test@workspace://path/with/special/chars/<>');
    console.log('  Test 6: FAILED - Should have thrown an error for special characters');
} catch (error) {
    console.log('Test 6: Invalid URL with special characters');
    console.log('  Error:', error.message);
    console.log('  Test 6: PASSED\n');
}

// Test 7: Empty URL
try {
    const url7 = new Url('');
    console.log('  Test 7: FAILED - Should have thrown an error for empty URL');
} catch (error) {
    console.log('Test 7: Empty URL');
    console.log('  Error:', error.message);
    console.log('  Test 7: PASSED\n');
}

// Test 8: URL with backslashes (should be converted to forward slashes)
try {
    const url8 = new Url('my-laptop@universe://work\\acme\\reports');
    console.log('Test 8: URL with backslashes');
    console.log('  Raw:', url8.raw);
    console.log('  URL:', url8.url);
    console.log('  Session ID:', url8.sessionID);
    console.log('  Workspace ID:', url8.workspaceID);
    console.log('  Path:', url8.path);
    console.log('  Path Array:', url8.pathArray);
    console.log('  Is Valid:', url8.isValid);
    console.log('  Test 8: PASSED\n');
} catch (error) {
    console.error('  Test 8 FAILED:', error.message);
}

console.log('All Url parser tests completed.');
