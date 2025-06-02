#!/usr/bin/env node

/**
 * Test script to verify auto-open tabs functionality
 *
 * This script helps diagnose why auto-open tabs might not be working
 */

console.log('🔗 Starting Auto-Open Tabs Test\n');

// Simulate the configuration check
console.log('1️⃣ Configuration Check:\n');

const DEFAULT_CONFIG = {
  sync: {
    tabBehaviorOnContextChange: "Keep",
    autoOpenCanvasTabs: false  // ⚠️ This is false by default!
  }
};

console.log('   📋 Default Configuration:');
console.log(`   - autoOpenCanvasTabs: ${DEFAULT_CONFIG.sync.autoOpenCanvasTabs}`);
console.log('   ⚠️  ISSUE: Auto-open is disabled by default!');
console.log('');

console.log('2️⃣ Document Insert Event Simulation:\n');

// Mock document insert event
const mockDocumentEvent = {
  contextId: "user@example.com/default",
  operation: "insert",
  documents: [
    { id: 1, url: "https://example.com", title: "Example Site" },
    { id: 2, url: "https://github.com", title: "GitHub" },
    { id: 3, title: "Non-URL Document" } // No URL
  ],
  timestamp: new Date().toISOString()
};

console.log('   📄 Mock Document Event:');
console.log(`   - Context: ${mockDocumentEvent.contextId}`);
console.log(`   - Documents: ${mockDocumentEvent.documents.length}`);
console.log('');

// Simulate the auto-open logic
console.log('3️⃣ Auto-Open Logic Simulation:\n');

function simulateAutoOpenLogic(event, config) {
  console.log('   🔍 Checking if this is for current context...');
  // Assume it's for current context
  console.log('   ✅ Event is for current context');

  console.log('   🔍 Extracting URLs from documents...');
  const documents = event.documents || [event.document];
  const tabUrls = documents
    .filter((doc) => {
      if (!doc || !doc.url) return false;
      try {
        new URL(doc.url);
        return true;
      } catch {
        return false;
      }
    })
    .map((doc) => doc.url);

  console.log(`   📋 Valid URLs found: ${tabUrls.length}`);
  tabUrls.forEach(url => console.log(`   - ${url}`));

  if (tabUrls.length > 0) {
    console.log('   🔧 Checking auto-open configuration...');
    if (config.sync.autoOpenCanvasTabs) {
      console.log('   ✅ Auto-open is ENABLED - would open tabs');
      console.log(`   🌐 Would open ${tabUrls.length} new tabs`);
    } else {
      console.log('   ❌ Auto-open is DISABLED - no tabs opened');
      console.log('   💡 User needs to enable this setting');
    }
  } else {
    console.log('   ℹ️  No valid URLs to open');
  }
}

simulateAutoOpenLogic(mockDocumentEvent, DEFAULT_CONFIG);
console.log('');

console.log('4️⃣ How to Enable Auto-Open:\n');
console.log('   📋 Steps to enable auto-open tabs:');
console.log('   1. Open browser extension popup');
console.log('   2. Go to Settings/Configuration');
console.log('   3. Find "Automatically open tabs on context change"');
console.log('   4. Enable the checkbox');
console.log('   5. Save settings');
console.log('');

console.log('5️⃣ Testing with Auto-Open Enabled:\n');
const enabledConfig = {
  sync: {
    tabBehaviorOnContextChange: "Keep",
    autoOpenCanvasTabs: true  // ✅ Enabled!
  }
};

console.log('   🔧 Configuration with auto-open enabled:');
simulateAutoOpenLogic(mockDocumentEvent, enabledConfig);
console.log('');

console.log('📝 Troubleshooting Checklist:\n');
console.log('   1. ❓ Is autoOpenCanvasTabs enabled in extension settings?');
console.log('   2. ❓ Are document events being received by the extension?');
console.log('   3. ❓ Are the inserted documents valid URLs?');
console.log('   4. ❓ Is the browser extension connected to the server?');
console.log('   5. ❓ Are there any console errors in the extension?');
console.log('');

console.log('🔧 Browser Console Commands to Debug:\n');
console.log('   📋 Open browser extension developer tools and run:');
console.log('   ```javascript');
console.log('   // Check current configuration');
console.log('   browser.storage.local.get().then(console.log);');
console.log('   ');
console.log('   // Check if auto-open is enabled');
console.log('   browser.storage.local.get(["CNVS_CONFIG"]).then(config => {');
console.log('     console.log("Auto-open enabled:", config.CNVS_CONFIG?.sync?.autoOpenCanvasTabs);');
console.log('   });');
console.log('   ```');
console.log('');

console.log('✅ Auto-Open Tabs Test Completed!');
console.log('💡 Most likely issue: Auto-open is disabled by default');
console.log('🎯 Solution: Enable auto-open in extension settings');
