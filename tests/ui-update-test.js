#!/usr/bin/env node

/**
 * Test script to verify UI update functionality
 *
 * This script tests the complete flow from context switching to UI updates
 */

console.log('🎯 Starting UI Update Test\n');

// Simulate the event flow
console.log('📋 Test: Context Switch with Tab Clearing\n');

// Mock the event flow
class MockTabIndex {
  constructor() {
    this.canvasTabs = new Map();
    // Simulate some existing tabs
    this.canvasTabs.set('https://example.com', { id: 1, url: 'https://example.com', title: 'Example' });
    this.canvasTabs.set('https://test.com', { id: 2, url: 'https://test.com', title: 'Test' });
  }

  getCanvasTabArray() {
    return Array.from(this.canvasTabs.values());
  }

  clearCanvasTabs() {
    this.canvasTabs.clear();
  }
}

class MockReduxStore {
  constructor() {
    this.state = {
      canvasTabs: [
        { id: 1, url: 'https://example.com', title: 'Example' },
        { id: 2, url: 'https://test.com', title: 'Test' }
      ]
    };
  }

  dispatch(action) {
    console.log(`   🔄 Redux Action: ${action.type}`);
    if (action.type === 'REMOVE_CANVAS_TABS') {
      this.state.canvasTabs = this.state.canvasTabs.filter(
        tab => !action.payload.some(removedTab => removedTab.url === tab.url)
      );
      console.log(`   📊 Redux State Updated: ${this.state.canvasTabs.length} tabs remaining`);
    }
  }

  getState() {
    return { tabs: this.state };
  }
}

function mockOnContextTabsUpdated(updateInfo) {
  console.log('   📡 onContextTabsUpdated called with:', JSON.stringify(updateInfo, null, 2));

  // Simulate the UI listener processing
  if (updateInfo.canvasTabs && updateInfo.canvasTabs.removedTabs) {
    console.log('   🔍 Processing removedTabs...');
    mockStore.dispatch({
      type: 'REMOVE_CANVAS_TABS',
      payload: updateInfo.canvasTabs.removedTabs
    });
  }
}

function mockSendRuntimeMessage(message) {
  console.log('   📨 Runtime Message:', message.type, '-', message.payload || '');

  // Simulate the UI listener receiving the message
  if (message.type === 'tabs:updated') {
    console.log('   🎯 UI received tabs:updated message');
    mockOnContextTabsUpdated(message.payload);
  }
}

// Initialize mocks
const mockIndex = new MockTabIndex();
const mockStore = new MockReduxStore();

console.log('🚀 Simulating Context Switch:\n');

console.log('1️⃣ Initial State:');
console.log(`   📊 TabIndex: ${mockIndex.getCanvasTabArray().length} tabs`);
console.log(`   📊 Redux Store: ${mockStore.getState().tabs.canvasTabs.length} tabs`);
console.log('');

console.log('2️⃣ Context Switch Detected (switching to empty context):');
// Simulate the context switch logic
const currentTabs = mockIndex.getCanvasTabArray();
console.log(`   📋 Current tabs before clearing: ${currentTabs.length}`);

mockIndex.clearCanvasTabs();
console.log(`   🗑️ TabIndex cleared: ${mockIndex.getCanvasTabArray().length} tabs`);

if (currentTabs.length > 0) {
  console.log('   📡 Sending UI notification...');
  mockSendRuntimeMessage({
    type: 'tabs:updated',
    payload: {
      canvasTabs: { removedTabs: currentTabs }
    }
  });
}
console.log('');

console.log('3️⃣ Final State:');
console.log(`   📊 TabIndex: ${mockIndex.getCanvasTabArray().length} tabs`);
console.log(`   📊 Redux Store: ${mockStore.getState().tabs.canvasTabs.length} tabs`);
console.log('');

console.log('📝 Expected Results:');
console.log('   ✅ TabIndex should be empty (0 tabs)');
console.log('   ✅ Redux Store should be empty (0 tabs)');
console.log('   ✅ UI should show "No canvas tabs found"');
console.log('');

console.log('🔧 Issues to Check:');
console.log('   1. Is onContextTabsUpdated being called?');
console.log('   2. Is the runtime message being sent?');
console.log('   3. Is the UI listener processing the message?');
console.log('   4. Is the Redux store being updated?');
console.log('   5. Is the component re-rendering?');
console.log('');

console.log('✅ UI Update Test Completed!');
console.log('🎯 If you see this flow working but the real extension doesn\'t update,');
console.log('   check the browser console for any errors in the event chain.');
