// Canvas Extension Popup JavaScript
// Handles popup UI interactions and communication with background service worker

// Import FuzzySearch for fuzzy search
import FuzzySearch from './fuse.js';

// DOM elements
let connectionStatus, connectionText, contextInfo, contextId, contextUrl;
let searchInput, autoSyncNew, autoOpenNew, showSyncedTabs;
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
let allBrowserTabs = []; // All tabs including synced ones
let syncedTabIds = new Set(); // Track which tabs are already synced
let showingSyncedTabs = false; // Track checkbox state
let selectedBrowserTabs = new Set();
let selectedCanvasTabs = new Set();
let currentTab = 'browser-to-canvas';

// Fuzzy search instances
let browserTabsFuse = null;
let canvasTabsFuse = null;

// Fuzzy search configuration
const fuseConfig = {
  keys: [
    { name: 'title', weight: 0.7 },
    { name: 'url', weight: 0.3 },
    { name: 'data.title', weight: 0.7 },
    { name: 'data.url', weight: 0.3 }
  ],
  threshold: 0.4, // More lenient threshold for better fuzzy matching
  location: 0,
  distance: 100,
  minMatchCharLength: 1,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  await loadInitialData();
});

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message);

  switch (message.type) {
    case 'tabs.refresh':
      console.log('Refreshing tabs due to context change');
      loadTabs();
      break;

    case 'context.changed':
      console.log('Context changed:', message.data);
      // Update context display
      if (message.data.contextId && message.data.url) {
        contextId.textContent = message.data.contextId;
        contextUrl.textContent = message.data.url;
      }
      break;

    case 'websocket.context.joined':
      console.log('Joined context:', message.data);
      break;
  }
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
  showSyncedTabs = document.getElementById('showSyncedTabs');
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
  showSyncedTabs.addEventListener('change', handleShowSyncedChange);

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

  // Event delegation for browser tab actions
  browserToCanvasList.addEventListener('click', handleBrowserTabAction);

  // Event delegation for Canvas tab actions
  canvasToBrowserList.addEventListener('click', handleCanvasTabAction);

  // Event delegation for checkboxes
  browserToCanvasList.addEventListener('change', handleBrowserTabCheckbox);
  canvasToBrowserList.addEventListener('change', handleCanvasTabCheckbox);

  // Event delegation for favicon error handling
  browserToCanvasList.addEventListener('error', handleImageError, true);
  canvasToBrowserList.addEventListener('error', handleImageError, true);
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

    // Initialize section header based on checkbox state
    const sectionHeader = document.querySelector('#browser-to-canvas .section-header h3');
    if (sectionHeader) {
      sectionHeader.textContent = showingSyncedTabs ? 'Browser Tabs' : 'Unsynced Browser Tabs';
    }

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

    // Get all browser tabs (both synced and unsynced)
    console.log('Requesting all browser tabs...');
    const allTabsResponse = await sendMessageToBackground('GET_ALL_TABS');
    console.log('All browser tabs response:', allTabsResponse);

    if (allTabsResponse.success) {
      allBrowserTabs = allTabsResponse.tabs || [];
      console.log('All browser tabs loaded:', allBrowserTabs.length);

      // Get synced tab URLs from Canvas documents to identify which tabs are synced
      if (currentConnection.connected && currentConnection.context) {
        const canvasResponse = await sendMessageToBackground('GET_CANVAS_DOCUMENTS');
        if (canvasResponse.success) {
          const syncedUrls = new Set(
            (canvasResponse.documents || []).map(doc => doc.data?.url).filter(Boolean)
          );

          // Mark which tabs are synced
          syncedTabIds.clear();
          allBrowserTabs.forEach(tab => {
            if (syncedUrls.has(tab.url)) {
              syncedTabIds.add(tab.id);
            }
          });

          console.log('Synced tab IDs:', Array.from(syncedTabIds));
        }
      }

      // Filter tabs based on showSyncedTabs setting
      updateBrowserTabsFilter();
      renderBrowserTabs();
    } else {
      console.error('Failed to get browser tabs:', allTabsResponse.error);
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

    // Initialize fuzzy search instances with the loaded data
    initializeFuseInstances();

    // If there's an active search, re-apply it with the new data
    if (searchInput && searchInput.value.trim()) {
      handleSearch({ target: { value: searchInput.value } });
    }
  } catch (error) {
    console.error('Failed to load tabs:', error);
  }
}

function updateBrowserTabsFilter() {
  if (showingSyncedTabs) {
    // Show all tabs
    browserTabs = [...allBrowserTabs];
  } else {
    // Show only unsynced tabs
    browserTabs = allBrowserTabs.filter(tab => !syncedTabIds.has(tab.id));
  }
  console.log(`Filtered browser tabs: ${browserTabs.length} of ${allBrowserTabs.length} total`);
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
    const emptyMessage = showingSyncedTabs ? 'No browser tabs found' : 'No syncable tabs found';
    browserToCanvasList.innerHTML = `<div class="empty-state">${emptyMessage}<br><small>Check console for filtering details</small></div>`;
    return;
  }

  browserToCanvasList.innerHTML = browserTabs.map(tab => {
    const isSynced = syncedTabIds.has(tab.id);
    const syncButtonDisabled = isSynced ? 'disabled' : '';
    const syncButtonTitle = isSynced ? 'Already synced to Canvas' : 'Sync to Canvas';
    const tabClass = isSynced ? 'tab-item synced' : 'tab-item';

    return `
      <div class="${tabClass}" data-tab-id="${tab.id}">
        <label class="tab-checkbox">
          <input type="checkbox" data-tab-id="${tab.id}" ${isSynced ? 'disabled' : ''}>
          <span class="checkmark"></span>
        </label>
        <img src="${tab.favIconUrl || '../assets/icons/logo-br_64x64.png'}" class="tab-favicon" data-fallback="../assets/icons/logo-br_64x64.png">
        <div class="tab-info">
          <div class="tab-title">${escapeHtml(tab.title)}</div>
          <div class="tab-url">${escapeHtml(tab.url)}</div>
        </div>
        <div class="tab-actions">
          <button class="action-btn small primary" data-action="sync" data-tab-id="${tab.id}" title="${syncButtonTitle}" ${syncButtonDisabled}>↗</button>
          <button class="action-btn small danger" data-action="close" data-tab-id="${tab.id}" title="Close tab">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Setup checkbox listeners
  browserToCanvasList.querySelectorAll('input[type="checkbox"]:not([disabled])').forEach(checkbox => {
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
      <img src="${tab.data?.favIconUrl || '../assets/icons/logo-br_64x64.png'}" class="tab-favicon" data-fallback="../assets/icons/logo-br_64x64.png">
      <div class="tab-info">
        <div class="tab-title">${escapeHtml(tab.data?.title || 'Untitled')}</div>
        <div class="tab-url">${escapeHtml(tab.data?.url || 'No URL')}</div>
      </div>
      <div class="tab-actions">
        <button class="action-btn small primary" data-action="open" data-document-id="${tab.id}" title="Open in browser">↙</button>
        <button class="action-btn small warning" data-action="remove" data-document-id="${tab.id}" title="Remove from context">⊖</button>
        <button class="action-btn small danger" data-action="delete" data-document-id="${tab.id}" title="Delete from database">🗑</button>
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
  const query = event.target.value.trim();
  console.log('Fuzzy searching for:', query);

  // Clear search if empty
  if (!query) {
    clearSearch();
    return;
  }

  // Perform fuzzy search based on current tab
  if (currentTab === 'browser-to-canvas') {
    performFuzzySearch(query, 'browser');
  } else if (currentTab === 'canvas-to-browser') {
    performFuzzySearch(query, 'canvas');
  }
}

function performFuzzySearch(query, type) {
  let results = [];
  let container, fuse;

  if (type === 'browser') {
    container = browserToCanvasList;
    fuse = browserTabsFuse;
  } else if (type === 'canvas') {
    container = canvasToBrowserList;
    fuse = canvasTabsFuse;
  } else {
    return;
  }

  // Perform fuzzy search if Fuse instance exists
  if (fuse && query) {
    const searchResults = fuse.search(query);
    console.log(`Fuzzy search results for "${query}":`, searchResults);

    // Extract the items from search results
    results = searchResults.map(result => ({
      item: result.item,
      score: result.score,
      matches: result.matches
    }));
  }

  // Apply search results to UI
  applySearchResults(container, results, type);
}

function applySearchResults(container, results, type) {
  const tabItems = container.querySelectorAll('.tab-item');

  if (results.length === 0) {
    // No search results - hide all items and show search empty state
    tabItems.forEach(item => {
      item.style.display = 'none';
      item.removeAttribute('data-search-match');
    });

    // Show search-specific empty state
    showSearchEmptyState(container, searchInput.value);
    return;
  }

  // Hide any existing empty state
  hideEmptyState(container);

  // Create a set of matching item IDs for quick lookup
  const matchingIds = new Set();
  results.forEach(result => {
    const item = result.item;
    if (type === 'browser') {
      matchingIds.add(item.id);
    } else if (type === 'canvas') {
      matchingIds.add(item.id);
    }
  });

  // Show/hide items based on search results
  tabItems.forEach(item => {
    const itemId = type === 'browser'
      ? parseInt(item.dataset.tabId)
      : parseInt(item.dataset.documentId);

    if (matchingIds.has(itemId)) {
      item.style.display = 'flex';
      item.setAttribute('data-search-match', 'true');

      // Add search highlighting if available
      const searchResult = results.find(r =>
        (type === 'browser' ? r.item.id : r.item.id) === itemId
      );
      highlightSearchMatches(item, searchResult);
    } else {
      item.style.display = 'none';
      item.removeAttribute('data-search-match');
    }
  });
}

function showSearchEmptyState(container, query) {
  let emptyState = container.querySelector('.empty-state');

  if (!emptyState) {
    emptyState = document.createElement('div');
    emptyState.className = 'empty-state search-empty';
    container.appendChild(emptyState);
  }

  emptyState.className = 'empty-state search-empty';
  emptyState.textContent = `No tabs match "${query}"`;
  emptyState.style.display = 'block';
}

function hideEmptyState(container) {
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) {
    emptyState.style.display = 'none';
  }
}

function highlightSearchMatches(itemElement, searchResult) {
  if (!searchResult || !searchResult.matches) return;

  // Remove existing highlights
  clearHighlights(itemElement);

  // Apply highlights based on FuzzySearch matches
  searchResult.matches.forEach(match => {
    const key = match.key;
    let targetElement = null;

    if (key === 'title' || key === 'data.title') {
      targetElement = itemElement.querySelector('.tab-title');
    } else if (key === 'url' || key === 'data.url') {
      targetElement = itemElement.querySelector('.tab-url');
    }

    if (targetElement && match.indices) {
      highlightText(targetElement, match.indices, match.value);
    }
  });
}

function highlightText(element, indices, text) {
  if (!element || !indices || !text) return;

  let highlightedText = '';
  let lastIndex = 0;

  // Sort indices by start position
  const sortedIndices = indices.sort((a, b) => a[0] - b[0]);

  sortedIndices.forEach(([start, end]) => {
    // Add text before highlight
    highlightedText += escapeHtml(text.substring(lastIndex, start));

    // Add highlighted text
    highlightedText += `<mark class="search-highlight">${escapeHtml(text.substring(start, end + 1))}</mark>`;

    lastIndex = end + 1;
  });

  // Add remaining text
  highlightedText += escapeHtml(text.substring(lastIndex));

  element.innerHTML = highlightedText;
}

function clearHighlights(element) {
  const highlights = element.querySelectorAll('.search-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
    parent.normalize();
  });
}

function clearSearch() {
  console.log('Clearing search');

  // Show all items in the current tab
  const container = currentTab === 'browser-to-canvas'
    ? browserToCanvasList
    : canvasToBrowserList;

  const tabItems = container.querySelectorAll('.tab-item');
  tabItems.forEach(item => {
    item.style.display = 'flex';
    item.removeAttribute('data-search-match');
    clearHighlights(item);
  });

  // Show original empty state if no items
  if (tabItems.length === 0) {
    let emptyState = container.querySelector('.empty-state');
    if (emptyState) {
      emptyState.className = 'empty-state';
      if (currentTab === 'browser-to-canvas') {
        emptyState.textContent = 'No syncable tabs found';
      } else {
        emptyState.textContent = 'No context tabs to open';
      }
      emptyState.style.display = 'block';
    }
  } else {
    hideEmptyState(container);
  }
}

function initializeFuseInstances() {
  console.log('Initializing FuzzySearch search instances...');

  // Initialize browser tabs fuzzy search
  if (browserTabs && browserTabs.length > 0) {
    browserTabsFuse = new FuzzySearch(browserTabs, fuseConfig);
    console.log('Browser tabs FuzzySearch instance created with', browserTabs.length, 'items');
  } else {
    browserTabsFuse = null;
  }

  // Initialize Canvas documents fuzzy search
  if (canvasTabs && canvasTabs.length > 0) {
    canvasTabsFuse = new FuzzySearch(canvasTabs, fuseConfig);
    console.log('Canvas tabs FuzzySearch instance created with', canvasTabs.length, 'items');
  } else {
    canvasTabsFuse = null;
  }
}

function filterTabItems(container, query, type) {
  // Legacy function - now handled by performFuzzySearch
  // Keep for backwards compatibility but redirect to fuzzy search
  if (query) {
    performFuzzySearch(query, type);
  } else {
    clearSearch();
  }
}

function handleSyncSettingChange(event) {
  // TODO: Save sync settings to background
  console.log('TODO: Save sync setting:', event.target.id, event.target.checked);
}

function handleShowSyncedChange(event) {
  showingSyncedTabs = event.target.checked;
  console.log('Show synced tabs toggled:', showingSyncedTabs);

  // Update the section header
  const sectionHeader = document.querySelector('#browser-to-canvas .section-header h3');
  if (sectionHeader) {
    sectionHeader.textContent = showingSyncedTabs ? 'Browser Tabs' : 'Unsynced Browser Tabs';
  }

  // Re-render browser tabs with new filter
  renderBrowserTabs();
}

function handleBrowserTabSelection(event) {
  const tabId = parseInt(event.target.dataset.tabId);
  if (event.target.checked) {
    selectedBrowserTabs.add(tabId);
  } else {
    selectedBrowserTabs.delete(tabId);
  }

  updateBulkActionVisibility();
}

function handleCanvasTabSelection(event) {
  const documentId = parseInt(event.target.dataset.documentId);
  if (event.target.checked) {
    selectedCanvasTabs.add(documentId);
  } else {
    selectedCanvasTabs.delete(documentId);
  }

  updateBulkActionVisibility();
}

function updateBulkActionVisibility() {
  // Show/hide bulk actions for browser tabs
  if (selectedBrowserTabs.size > 0) {
    browserBulkActions.style.display = 'flex';
  } else {
    browserBulkActions.style.display = 'none';
  }

  // Show/hide bulk actions for Canvas tabs
  if (selectedCanvasTabs.size > 0) {
    canvasBulkActions.style.display = 'flex';
  } else {
    canvasBulkActions.style.display = 'none';
  }
}

// Tab action handlers (now called via event delegation)
async function handleSyncTab(tabId) {
  try {
    console.log('Syncing tab:', tabId);

    // Find the tab
    const tab = browserTabs.find(t => t.id === tabId);
    if (!tab) {
      console.error('Tab not found:', tabId);
      return;
    }

    const response = await sendMessageToBackground('SYNC_TAB', { tab });
    console.log('Sync tab response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists
    }
  } catch (error) {
    console.error('Failed to sync tab:', error);
  }
}

async function handleCloseTab(tabId) {
  try {
    console.log('Closing tab:', tabId);

    const response = await sendMessageToBackground('CLOSE_TAB', { tabId });
    console.log('Close tab response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists
    }
  } catch (error) {
    console.error('Failed to close tab:', error);
  }
}

async function handleOpenCanvasTab(documentId) {
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
}

async function handleRemoveCanvasTab(documentId) {
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
}

async function handleDeleteCanvasTab(documentId) {
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
}

// Event delegation handlers
function handleBrowserTabAction(event) {
  console.log('Browser tab action event triggered:', event.target);

  const button = event.target.closest('button[data-action]');
  console.log('Found button:', button);

  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  const action = button.dataset.action;
  const tabId = parseInt(button.dataset.tabId);

  console.log('Action:', action, 'TabId:', tabId);

  if (!tabId) {
    console.error('No tabId found for action:', action);
    return;
  }

  switch (action) {
    case 'sync':
      console.log('Calling handleSyncTab with tabId:', tabId);
      handleSyncTab(tabId);
      break;
    case 'close':
      console.log('Calling handleCloseTab with tabId:', tabId);
      handleCloseTab(tabId);
      break;
    default:
      console.warn('Unknown browser tab action:', action);
  }
}

function handleCanvasTabAction(event) {
  console.log('Canvas tab action event triggered:', event.target);

  const button = event.target.closest('button[data-action]');
  console.log('Found button:', button);

  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  const action = button.dataset.action;
  const documentId = parseInt(button.dataset.documentId);

  console.log('Action:', action, 'DocumentId:', documentId);

  if (!documentId) {
    console.error('No documentId found for action:', action);
    return;
  }

  switch (action) {
    case 'open':
      console.log('Calling handleOpenCanvasTab with documentId:', documentId);
      handleOpenCanvasTab(documentId);
      break;
    case 'remove':
      console.log('Calling handleRemoveCanvasTab with documentId:', documentId);
      handleRemoveCanvasTab(documentId);
      break;
    case 'delete':
      console.log('Calling handleDeleteCanvasTab with documentId:', documentId);
      handleDeleteCanvasTab(documentId);
      break;
    default:
      console.warn('Unknown Canvas tab action:', action);
  }
}

function handleBrowserTabCheckbox(event) {
  const checkbox = event.target.closest('input[type="checkbox"][data-tab-id]');
  if (!checkbox) return;

  const tabId = parseInt(checkbox.dataset.tabId);
  if (!tabId) return;

  if (checkbox.checked) {
    selectedBrowserTabs.add(tabId);
  } else {
    selectedBrowserTabs.delete(tabId);
  }

  updateBulkActionVisibility();
}

function handleCanvasTabCheckbox(event) {
  const checkbox = event.target.closest('input[type="checkbox"][data-document-id]');
  if (!checkbox) return;

  const documentId = parseInt(checkbox.dataset.documentId);
  if (!documentId) return;

  if (checkbox.checked) {
    selectedCanvasTabs.add(documentId);
  } else {
    selectedCanvasTabs.delete(documentId);
  }

  updateBulkActionVisibility();
}

// Event delegation for favicon error handling
function handleImageError(event) {
  const img = event.target;
  if (img && img.tagName === 'IMG' && img.classList.contains('tab-favicon')) {
    console.log('Favicon failed to load, using fallback:', img.src);
    const fallback = img.dataset.fallback || '../assets/icons/logo-br_64x64.png';
    if (img.src !== fallback) {
      img.src = fallback;
    }
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
