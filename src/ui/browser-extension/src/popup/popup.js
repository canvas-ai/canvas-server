// Canvas Extension Popup JavaScript
// Handles popup UI interactions and communication with background service worker

// DOM elements
let connectionStatus, connectionText, contextInfo, contextId, contextUrl;
let searchInput, autoSyncNew, autoOpenNew;
let browserToCanvasList, canvasToBrowserList;
let syncAllBtn, closeAllBtn, openAllBtn, settingsBtn;
let browserBulkActions, canvasBulkActions;
let syncSelectedBtn, closeSelectedBtn, openSelectedBtn, removeSelectedBtn, deleteSelectedBtn;

// Tab elements
let browserToCanvasTab, canvasToBrowserTab;
let browserToCanvasContent, canvasToBrowserContent;

// State
let currentConnection = { connected: false, context: null };
let browserTabs = [];
let canvasTabs = [];
let selectedBrowserTabs = new Set();
let selectedCanvasTabs = new Set();
let currentTab = 'browser-to-canvas';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  await loadInitialData();
});

function initializeElements() {
  // Header elements
  connectionStatus = document.getElementById('connectionStatus');
  connectionText = document.getElementById('connectionText');
  contextInfo = document.getElementById('contextInfo');
  contextId = document.getElementById('contextId');
  contextUrl = document.getElementById('contextUrl');

  // Search and settings
  searchInput = document.getElementById('searchInput');
  autoSyncNew = document.getElementById('autoSyncNew');
  autoOpenNew = document.getElementById('autoOpenNew');
  settingsBtn = document.getElementById('settingsBtn');

  // Tab navigation
  browserToCanvasTab = document.getElementById('browserToCanvasTab');
  canvasToBrowserTab = document.getElementById('canvasToBrowserTab');

  // Tab content
  browserToCanvasContent = document.getElementById('browser-to-canvas');
  canvasToBrowserContent = document.getElementById('canvas-to-browser');

  // Tab lists
  browserToCanvasList = document.getElementById('browserToCanvasList');
  canvasToBrowserList = document.getElementById('canvasToBrowserList');

  // Action buttons
  syncAllBtn = document.getElementById('syncAllBtn');
  closeAllBtn = document.getElementById('closeAllBtn');
  openAllBtn = document.getElementById('openAllBtn');

  // Bulk actions
  browserBulkActions = document.getElementById('browserBulkActions');
  canvasBulkActions = document.getElementById('canvasBulkActions');
  syncSelectedBtn = document.getElementById('syncSelectedBtn');
  closeSelectedBtn = document.getElementById('closeSelectedBtn');
  openSelectedBtn = document.getElementById('openSelectedBtn');
  removeSelectedBtn = document.getElementById('removeSelectedBtn');
  deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
}

function setupEventListeners() {
  // Settings button
  settingsBtn.addEventListener('click', openSettingsPage);

  // Tab navigation
  browserToCanvasTab.addEventListener('click', () => switchTab('browser-to-canvas'));
  canvasToBrowserTab.addEventListener('click', () => switchTab('canvas-to-browser'));

  // Search
  searchInput.addEventListener('input', handleSearch);

  // Sync settings toggles
  autoSyncNew.addEventListener('change', handleSyncSettingChange);
  autoOpenNew.addEventListener('change', handleSyncSettingChange);

  // Action buttons
  syncAllBtn.addEventListener('click', () => handleSyncAll());
  closeAllBtn.addEventListener('click', () => handleCloseAll());
  openAllBtn.addEventListener('click', () => handleOpenAll());

  // Bulk actions
  syncSelectedBtn.addEventListener('click', () => handleSyncSelected());
  closeSelectedBtn.addEventListener('click', () => handleCloseSelected());
  openSelectedBtn.addEventListener('click', () => handleOpenSelected());
  removeSelectedBtn.addEventListener('click', () => handleRemoveSelected());
  deleteSelectedBtn.addEventListener('click', () => handleDeleteSelected());
}

// Tab switching functionality
function switchTab(tabName) {
  console.log('Switching to tab:', tabName);

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // Activate selected tab
  const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
  const targetContent = document.getElementById(tabName);

  if (targetTab && targetContent) {
    targetTab.classList.add('active');
    targetContent.classList.add('active');
    currentTab = tabName;

    // Clear selections when switching tabs
    clearSelections();

    // Apply search filter to current tab if there's a search query
    if (searchInput.value.trim()) {
      handleSearch({ target: { value: searchInput.value } });
    }
  }
}

function clearSelections() {
  selectedBrowserTabs.clear();
  selectedCanvasTabs.clear();
  browserBulkActions.style.display = 'none';
  canvasBulkActions.style.display = 'none';

  // Uncheck all checkboxes
  document.querySelectorAll('.tab-checkbox input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = false;
  });
}

async function loadInitialData() {
  try {
    console.log('Loading initial data...');

    // Get connection status
    const response = await sendMessageToBackground('GET_CONNECTION_STATUS');
    console.log('Connection status response:', response);

    currentConnection = response;
    updateConnectionStatus(response);

    // Load tabs if connected (or always load for debugging)
    console.log('Loading tabs...');
    await loadTabs();

    // Load sync settings
    await loadSyncSettings();
  } catch (error) {
    console.error('Failed to load initial data:', error);
  }
}

function updateConnectionStatus(connection) {
  console.log('Popup: Updating connection status with:', connection);

  if (connection.connected) {
    console.log('Popup: Setting status to CONNECTED');
    connectionStatus.className = 'status-dot connected';
    connectionText.textContent = 'Connected';

    if (connection.context) {
      console.log('Popup: Setting context to:', connection.context.id);
      contextId.textContent = connection.context.id;
      contextUrl.textContent = connection.context.url;
    } else {
      console.log('Popup: No context bound');
      contextId.textContent = '-';
      contextUrl.textContent = 'No context bound';
    }
  } else {
    console.log('Popup: Setting status to DISCONNECTED');
    connectionStatus.className = 'status-dot disconnected';
    connectionText.textContent = 'Disconnected';
    contextId.textContent = '-';
    contextUrl.textContent = 'No context';
  }
}

async function loadTabs() {
  try {
    console.log('Loading tabs...');

    // Get browser tabs
    console.log('Requesting browser tabs...');
    const browserResponse = await sendMessageToBackground('GET_TABS', { type: 'browser' });
    console.log('Browser tabs response:', browserResponse);

    if (browserResponse.success) {
      browserTabs = browserResponse.tabs || [];
      console.log('Browser tabs loaded:', browserTabs.length);
      renderBrowserTabs();
    } else {
      console.error('Failed to get browser tabs:', browserResponse.error);
    }

    // Get canvas tabs (documents) - only if connected
    if (currentConnection.connected && currentConnection.context) {
      console.log('Requesting Canvas documents...');
      const canvasResponse = await sendMessageToBackground('GET_CANVAS_DOCUMENTS');
      console.log('Canvas documents response:', canvasResponse);

      if (canvasResponse.success) {
        canvasTabs = canvasResponse.documents || [];
        console.log('Canvas documents loaded:', canvasTabs.length);
        renderCanvasTabs();
      } else {
        console.error('Failed to get Canvas documents:', canvasResponse.error);
        canvasTabs = [];
        renderCanvasTabs();
      }
    } else {
      console.log('Not connected or no context - skipping Canvas documents');
      canvasTabs = [];
      renderCanvasTabs();
    }
  } catch (error) {
    console.error('Failed to load tabs:', error);
  }
}

async function loadSyncSettings() {
  try {
    // TODO: Load sync settings from background
    console.log('TODO: Load sync settings');
  } catch (error) {
    console.error('Failed to load sync settings:', error);
  }
}

function renderBrowserTabs() {
  console.log('Rendering browser tabs, count:', browserTabs.length);

  if (browserTabs.length === 0) {
    browserToCanvasList.innerHTML = '<div class="empty-state">No syncable tabs found<br><small>Check console for filtering details</small></div>';
    return;
  }

  browserToCanvasList.innerHTML = browserTabs.map(tab => `
    <div class="tab-item" data-tab-id="${tab.id}">
      <label class="tab-checkbox">
        <input type="checkbox" data-tab-id="${tab.id}">
        <span class="checkmark"></span>
      </label>
      <img src="${tab.favIconUrl || 'assets/icons/logo-br_64x64.png'}" class="tab-favicon" onerror="this.src='assets/icons/logo-br_64x64.png'">
      <div class="tab-info">
        <div class="tab-title">${escapeHtml(tab.title)}</div>
        <div class="tab-url">${escapeHtml(tab.url)}</div>
      </div>
      <div class="tab-actions">
        <button class="action-btn small" onclick="handlePinTab(${tab.id})" title="Pin tab">📌</button>
        <button class="action-btn small primary" onclick="handleSyncTab(${tab.id})" title="Sync to Canvas">↗</button>
        <button class="action-btn small danger" onclick="handleCloseTab(${tab.id})" title="Close tab">✕</button>
      </div>
    </div>
  `).join('');

  // Setup checkbox listeners
  browserToCanvasList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', handleBrowserTabSelection);
  });
}

function renderCanvasTabs() {
  if (canvasTabs.length === 0) {
    canvasToBrowserList.innerHTML = '<div class="empty-state">No context tabs to open</div>';
    return;
  }

  canvasToBrowserList.innerHTML = canvasTabs.map(tab => `
    <div class="tab-item" data-document-id="${tab.id}">
      <label class="tab-checkbox">
        <input type="checkbox" data-document-id="${tab.id}">
        <span class="checkmark"></span>
      </label>
      <img src="${tab.data.favIconUrl || 'assets/icons/logo-br_64x64.png'}" class="tab-favicon" onerror="this.src='assets/icons/logo-br_64x64.png'">
      <div class="tab-info">
        <div class="tab-title">${escapeHtml(tab.data.title)}</div>
        <div class="tab-url">${escapeHtml(tab.data.url)}</div>
      </div>
      <div class="tab-actions">
        <button class="action-btn small primary" onclick="handleOpenCanvasTab(${tab.id})" title="Open in browser">↙</button>
        <button class="action-btn small warning" onclick="handleRemoveCanvasTab(${tab.id})" title="Remove from context">⊖</button>
        <button class="action-btn small danger" onclick="handleDeleteCanvasTab(${tab.id})" title="Delete from database">🗑</button>
      </div>
    </div>
  `).join('');

  // Setup checkbox listeners
  canvasToBrowserList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', handleCanvasTabSelection);
  });
}

// Event handlers
async function openSettingsPage() {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
    window.close();
  } catch (error) {
    console.error('Failed to open settings page:', error);
  }
}

function handleSearch(event) {
  const query = event.target.value.toLowerCase();
  console.log('Searching for:', query);

  // Filter based on current tab
  if (currentTab === 'browser-to-canvas') {
    filterTabItems(browserToCanvasList, query, 'browser');
  } else if (currentTab === 'canvas-to-browser') {
    filterTabItems(canvasToBrowserList, query, 'canvas');
  }
}

function filterTabItems(container, query, type) {
  const tabItems = container.querySelectorAll('.tab-item');

  tabItems.forEach(item => {
    const title = item.querySelector('.tab-title')?.textContent.toLowerCase() || '';
    const url = item.querySelector('.tab-url')?.textContent.toLowerCase() || '';

    const matches = !query || title.includes(query) || url.includes(query);
    item.style.display = matches ? 'flex' : 'none';
  });

  // Show empty state if no items match
  const visibleItems = container.querySelectorAll('.tab-item[style="display: flex"], .tab-item:not([style*="display: none"])').length;
  let emptyState = container.querySelector('.empty-state');

  if (visibleItems === 0 && query) {
    if (!emptyState) {
      emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      container.appendChild(emptyState);
    }
    emptyState.textContent = `No tabs match "${query}"`;
    emptyState.style.display = 'block';
  } else if (emptyState) {
    emptyState.style.display = 'none';
  }
}

function handleSyncSettingChange(event) {
  // TODO: Save sync settings to background
  console.log('TODO: Save sync setting:', event.target.id, event.target.checked);
}

function handleBrowserTabSelection(event) {
  const tabId = parseInt(event.target.dataset.tabId);
  if (event.target.checked) {
    selectedBrowserTabs.add(tabId);
  } else {
    selectedBrowserTabs.delete(tabId);
  }

  browserBulkActions.style.display = selectedBrowserTabs.size > 0 ? 'block' : 'none';
}

function handleCanvasTabSelection(event) {
  const documentId = parseInt(event.target.dataset.documentId);
  if (event.target.checked) {
    selectedCanvasTabs.add(documentId);
  } else {
    selectedCanvasTabs.delete(documentId);
  }

  canvasBulkActions.style.display = selectedCanvasTabs.size > 0 ? 'block' : 'none';
}

// Action handlers (global functions for onclick)
window.handleSyncTab = async (tabId) => {
  try {
    const response = await sendMessageToBackground('SYNC_TAB', { tabId });
    if (response.success) {
      await loadTabs(); // Refresh lists
    }
  } catch (error) {
    console.error('Failed to sync tab:', error);
  }
};

window.handleCloseTab = async (tabId) => {
  try {
    const response = await sendMessageToBackground('CLOSE_TAB', { tabId });
    if (response.success) {
      await loadTabs(); // Refresh lists
    }
  } catch (error) {
    console.error('Failed to close tab:', error);
  }
};

window.handleOpenCanvasTab = async (documentId) => {
  try {
    console.log('Opening Canvas document:', documentId);

    // Find the Canvas document
    const document = canvasTabs.find(doc => doc.id === documentId);
    if (!document) {
      console.error('Canvas document not found:', documentId);
      return;
    }

    const response = await sendMessageToBackground('OPEN_CANVAS_DOCUMENT', { document });
    console.log('Open Canvas document response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists
    } else {
      console.error('Failed to open Canvas document:', response.error);
    }
  } catch (error) {
    console.error('Failed to open Canvas tab:', error);
  }
};

window.handleRemoveCanvasTab = async (documentId) => {
  try {
    console.log('Removing Canvas document:', documentId);

    // Find the Canvas document
    const document = canvasTabs.find(doc => doc.id === documentId);
    if (!document) {
      console.error('Canvas document not found:', documentId);
      return;
    }

    const response = await sendMessageToBackground('REMOVE_CANVAS_DOCUMENT', {
      document,
      closeTab: false
    });
    console.log('Remove Canvas document response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists
    } else {
      console.error('Failed to remove Canvas document:', response.error);
    }
  } catch (error) {
    console.error('Failed to remove from context:', error);
  }
};

window.handleDeleteCanvasTab = async (documentId) => {
  try {
    console.log('Deleting Canvas document:', documentId);

    // Find the Canvas document
    const document = canvasTabs.find(doc => doc.id === documentId);
    if (!document) {
      console.error('Canvas document not found:', documentId);
      return;
    }

    // Use the removeDocument API with deleteFromDatabase option
    const response = await sendMessageToBackground('REMOVE_CANVAS_DOCUMENT', {
      document,
      closeTab: true
    });
    console.log('Delete Canvas document response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists
    } else {
      console.error('Failed to delete Canvas document:', response.error);
    }
  } catch (error) {
    console.error('Failed to delete from database:', error);
  }
};

window.handlePinTab = async (tabId) => {
  // TODO: Implement tab pinning
  console.log('TODO: Pin tab:', tabId);
};

// Bulk action handlers
async function handleSyncAll() {
  try {
    console.log('Syncing all browser tabs');

    if (browserTabs.length === 0) {
      console.log('No browser tabs to sync');
      return;
    }

    const tabIds = browserTabs.map(tab => tab.id);
    const response = await sendMessageToBackground('SYNC_MULTIPLE_TABS', { tabIds });
    console.log('Sync all response:', response);

    if (response.success) {
      console.log(`Synced ${response.successful}/${response.total} tabs`);
      await loadTabs(); // Refresh lists
    } else {
      console.error('Failed to sync all tabs:', response.error);
    }
  } catch (error) {
    console.error('Failed to sync all tabs:', error);
  }
}

async function handleCloseAll() {
  try {
    console.log('Closing all browser tabs');

    if (browserTabs.length === 0) {
      console.log('No browser tabs to close');
      return;
    }

    for (const tab of browserTabs) {
      await sendMessageToBackground('CLOSE_TAB', { tabId: tab.id });
    }

    console.log('All browser tabs closed');
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to close all tabs:', error);
  }
}

async function handleOpenAll() {
  try {
    console.log('Opening all Canvas tabs');

    if (canvasTabs.length === 0) {
      console.log('No Canvas tabs to open');
      return;
    }

    for (const document of canvasTabs) {
      await sendMessageToBackground('OPEN_CANVAS_DOCUMENT', { document });
    }

    console.log('All Canvas tabs opened');
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to open all Canvas tabs:', error);
  }
}

async function handleSyncSelected() {
  try {
    const selectedIds = Array.from(selectedBrowserTabs);
    console.log('Syncing selected tabs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No tabs selected for syncing');
      return;
    }

    const response = await sendMessageToBackground('SYNC_MULTIPLE_TABS', { tabIds: selectedIds });
    console.log('Sync selected response:', response);

    if (response.success) {
      console.log(`Synced ${response.successful}/${response.total} selected tabs`);
      selectedBrowserTabs.clear();
      await loadTabs(); // Refresh lists
    } else {
      console.error('Failed to sync selected tabs:', response.error);
    }
  } catch (error) {
    console.error('Failed to sync selected tabs:', error);
  }
}

async function handleCloseSelected() {
  try {
    const selectedIds = Array.from(selectedBrowserTabs);
    console.log('Closing selected tabs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No tabs selected for closing');
      return;
    }

    for (const tabId of selectedIds) {
      await sendMessageToBackground('CLOSE_TAB', { tabId });
    }

    console.log('Selected browser tabs closed');
    selectedBrowserTabs.clear();
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to close selected tabs:', error);
  }
}

async function handleOpenSelected() {
  try {
    const selectedIds = Array.from(selectedCanvasTabs);
    console.log('Opening selected Canvas tabs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No Canvas tabs selected for opening');
      return;
    }

    for (const documentId of selectedIds) {
      const document = canvasTabs.find(doc => doc.id === documentId);
      if (document) {
        await sendMessageToBackground('OPEN_CANVAS_DOCUMENT', { document });
      }
    }

    console.log('Selected Canvas tabs opened');
    selectedCanvasTabs.clear();
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to open selected Canvas tabs:', error);
  }
}

async function handleRemoveSelected() {
  try {
    const selectedIds = Array.from(selectedCanvasTabs);
    console.log('Removing selected Canvas tabs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No Canvas tabs selected for removal');
      return;
    }

    for (const documentId of selectedIds) {
      const document = canvasTabs.find(doc => doc.id === documentId);
      if (document) {
        await sendMessageToBackground('REMOVE_CANVAS_DOCUMENT', {
          document,
          closeTab: false
        });
      }
    }

    console.log('Selected Canvas tabs removed');
    selectedCanvasTabs.clear();
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to remove selected Canvas tabs:', error);
  }
}

async function handleDeleteSelected() {
  try {
    const selectedIds = Array.from(selectedCanvasTabs);
    console.log('Deleting selected Canvas tabs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No Canvas tabs selected for deletion');
      return;
    }

    for (const documentId of selectedIds) {
      const document = canvasTabs.find(doc => doc.id === documentId);
      if (document) {
        await sendMessageToBackground('REMOVE_CANVAS_DOCUMENT', {
          document,
          closeTab: true
        });
      }
    }

    console.log('Selected Canvas tabs deleted');
    selectedCanvasTabs.clear();
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to delete selected Canvas tabs:', error);
  }
}

// Utility functions
async function sendMessageToBackground(type, data = null) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
