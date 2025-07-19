// Tab Manager module for Canvas Extension
// Handles browser tab operations and Canvas document conversion

export class TabManager {
  constructor() {
    this.trackedTabs = new Map(); // tabId -> tab data
    this.syncedTabs = new Set(); // tabIds that are synced to Canvas
  }

  // Convert browser tab to Canvas document format (based on PAYLOAD.md format)
  convertTabToDocument(tab, browserIdentity) {
    const document = {
      schema: 'data/abstraction/tab',
      schemaVersion: '2.0',
      data: {
        // Browser tab properties as specified in design doc
        id: tab.id,
        windowId: tab.windowId,
        index: tab.index,
        highlighted: tab.highlighted,
        active: tab.active,
        pinned: tab.pinned,
        discarded: tab.discarded || false,
        incognito: tab.incognito,
        audible: tab.audible,
        mutedInfo: tab.mutedInfo,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        timestamp: new Date().toISOString()
      },
      featureArray: this.generateFeatureArray(browserIdentity),
      metadata: {
        contentType: 'application/json',
        contentEncoding: 'utf8',
        dataPaths: []
      },
      indexOptions: {
        checksumAlgorithms: ['sha1', 'sha256'],
        primaryChecksumAlgorithm: 'sha1',
        checksumFields: ['data.url'],
        ftsSearchFields: ['data.title', 'data.url'],
        vectorEmbeddingFields: ['data.title', 'data.url'],
        embeddingOptions: {
          embeddingModel: 'text-embedding-3-small',
          embeddingDimensions: 1536,
          embeddingProvider: 'openai',
          embeddingProviderOptions: {},
          chunking: {
            type: 'sentence',
            chunkSize: 1000,
            chunkOverlap: 200
          }
        }
      }
    };

    console.log('Converted tab to Canvas document:', document);
    return document;
  }

  // Generate feature array for tab document
  generateFeatureArray(browserIdentity) {
    const features = ['data/abstraction/tab'];

    // Add browser type
    if (browserIdentity) {
      if (browserIdentity.includes('chrome')) {
        features.push('client/app/chrome');
      } else if (browserIdentity.includes('firefox')) {
        features.push('client/app/firefox');
      } else if (browserIdentity.includes('edge')) {
        features.push('client/app/edge');
      } else if (browserIdentity.includes('safari')) {
        features.push('client/app/safari');
      }

      // Add instance identifier
      features.push(`tag/${browserIdentity}`);
    }

    return features;
  }

  // Check if tab should be synced (exclude internal pages)
  shouldSyncTab(tab) {
    if (!tab || !tab.url || !tab.title) return false;

    // Allow tabs that are complete or loading (but not discarded)
    if (tab.status && tab.status === 'unloaded') return false;
    if (tab.discarded === true) return false;

    // Exclude internal browser pages and extension pages
    const excludedProtocols = [
      'chrome://',
      'chrome-extension://',
      'chrome-search://',
      'chrome-devtools://',
      'moz-extension://',
      'edge://',
      'opera://',
      'brave://',
      'about:',
      'file://',
      'data:',
      'blob:',
      'javascript:',
      'view-source:',
      'wyciwyg://',
      'resource://'
    ];

    const excludedUrls = [
      'chrome://newtab/',
      'chrome://new-tab-page/',
      'about:newtab',
      'about:blank',
      'edge://newtab/',
      'opera://startpage/'
    ];

    const excludedTitles = [
      'New Tab',
      'New tab',
      'Newtab',
      'about:blank'
    ];

    // Check protocols
    for (const protocol of excludedProtocols) {
      if (tab.url.startsWith(protocol)) {
        return false;
      }
    }

    // Check specific URLs
    for (const url of excludedUrls) {
      if (tab.url === url) {
        return false;
      }
    }

    // Check titles (for pages that might have blank/new tab titles)
    for (const title of excludedTitles) {
      if (tab.title === title) {
        return false;
      }
    }

    // Must have http or https protocol for valid web pages
    return tab.url.startsWith('http://') || tab.url.startsWith('https://');
  }

  // Get all browser tabs
  async getAllTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      return tabs;
    } catch (error) {
      console.error('Failed to get all tabs:', error);
      return [];
    }
  }

  // Get tabs that should be synced
  async getSyncableTabs() {
    const allTabs = await this.getAllTabs();
    console.log('Total browser tabs found:', allTabs.length);

    const syncableTabs = allTabs.filter(tab => {
      const shouldSync = this.shouldSyncTab(tab);
      if (!shouldSync) {
        console.log('Filtering out tab:', tab.title, tab.url, 'Status:', tab.status, 'Discarded:', tab.discarded);
      }
      return shouldSync;
    });

    console.log('Syncable tabs after filtering:', syncableTabs.length);
    return syncableTabs;
  }

  // Get unsynced tabs
  async getUnsyncedTabs() {
    const syncableTabs = await this.getSyncableTabs();
    return syncableTabs.filter(tab => !this.syncedTabs.has(tab.id));
  }

  // Track tab as synced
  markTabAsSynced(tabId, documentId = null) {
    this.syncedTabs.add(tabId);
    if (documentId) {
      // Store mapping for future reference
      const tabData = this.trackedTabs.get(tabId) || {};
      tabData.documentId = documentId;
      this.trackedTabs.set(tabId, tabData);
    }
  }

  // Untrack tab
  unmarkTabAsSynced(tabId) {
    this.syncedTabs.delete(tabId);
    this.trackedTabs.delete(tabId);
  }

  // Check if tab is synced
  isTabSynced(tabId) {
    return this.syncedTabs.has(tabId);
  }

  // Get tab by ID
  async getTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      return tab;
    } catch (error) {
      console.error('Failed to get tab:', error);
      return null;
    }
  }

  // Open URL in new tab
  async openTab(url, options = {}) {
    try {
      const tab = await chrome.tabs.create({
        url,
        active: options.active !== false, // Default to active
        ...options
      });
      return tab;
    } catch (error) {
      console.error('Failed to open tab:', error);
      throw error;
    }
  }

  // Close tab
  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      this.unmarkTabAsSynced(tabId);
      return true;
    } catch (error) {
      console.error('Failed to close tab:', error);
      return false;
    }
  }

  // Close multiple tabs
  async closeTabs(tabIds) {
    try {
      await chrome.tabs.remove(tabIds);
      tabIds.forEach(tabId => this.unmarkTabAsSynced(tabId));
      return true;
    } catch (error) {
      console.error('Failed to close tabs:', error);
      return false;
    }
  }

  // Update tab
  async updateTab(tabId, updateProperties) {
    try {
      const tab = await chrome.tabs.update(tabId, updateProperties);
      return tab;
    } catch (error) {
      console.error('Failed to update tab:', error);
      return null;
    }
  }

  // Check if tab exists
  async tabExists(tabId) {
    try {
      await chrome.tabs.get(tabId);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get synced tab data
  getSyncedTabData(tabId) {
    return this.trackedTabs.get(tabId);
  }

  // Generate hash for tab (for duplicate detection)
  generateTabHash(tab) {
    return `${tab.url}|${tab.title}`;
  }

  // Find duplicate tabs by URL
  async findDuplicateTabs(url) {
    const allTabs = await this.getAllTabs();
    return allTabs.filter(tab => tab.url === url);
  }

  // Canvas Integration Methods

  // Compare browser tabs with Canvas documents to determine sync state
  compareWithCanvasDocuments(browserTabs, canvasDocuments) {
    const result = {
      browserToCanvas: [], // Browser tabs not in Canvas (need syncing)
      canvasToBrowser: [], // Canvas docs not open in browser
      synced: [] // Tabs that exist in both
    };

    // Create lookup maps for efficient comparison
    const browserTabsByUrl = new Map();
    const canvasDocsByUrl = new Map();

    // Index browser tabs by URL
    browserTabs.forEach(tab => {
      if (this.shouldSyncTab(tab)) {
        browserTabsByUrl.set(tab.url, tab);
      }
    });

    // Index Canvas documents by URL
    canvasDocuments.forEach(doc => {
      if (doc.schema === 'data/abstraction/tab' && doc.data?.url) {
        canvasDocsByUrl.set(doc.data.url, doc);
      }
    });

    // Find browser tabs not in Canvas
    browserTabsByUrl.forEach((tab, url) => {
      if (!canvasDocsByUrl.has(url)) {
        result.browserToCanvas.push(tab);
      } else {
        result.synced.push({
          browserTab: tab,
          canvasDoc: canvasDocsByUrl.get(url)
        });
        // Mark as synced in our tracking
        this.markTabAsSynced(tab.id, canvasDocsByUrl.get(url).id);
      }
    });

    // Find Canvas documents not open in browser
    canvasDocsByUrl.forEach((doc, url) => {
      if (!browserTabsByUrl.has(url)) {
        result.canvasToBrowser.push(doc);
      }
    });

    console.log('Tab sync comparison result:', {
      browserToCanvas: result.browserToCanvas.length,
      canvasToBrowser: result.canvasToBrowser.length,
      synced: result.synced.length
    });

    return result;
  }

  // Get tabs that need syncing to Canvas
  async getTabsToSync(canvasDocuments = []) {
    const browserTabs = await this.getSyncableTabs();
    const comparison = this.compareWithCanvasDocuments(browserTabs, canvasDocuments);
    return comparison.browserToCanvas;
  }

  // Get Canvas documents that should be opened in browser
  getDocumentsToOpen(canvasDocuments = []) {
    // This would typically be called after compareWithCanvasDocuments
    // For now, return all Canvas tab documents not currently tracked
    return canvasDocuments.filter(doc => {
      if (doc.schema !== 'data/abstraction/tab' || !doc.data?.url) return false;

      // Check if any browser tab has this URL
      const hasOpenTab = [...this.trackedTabs.values()].some(tabData =>
        tabData.url === doc.data.url
      );

      return !hasOpenTab;
    });
  }

  // Sync a browser tab to Canvas
  async syncTabToCanvas(tab, apiClient, contextId, browserIdentity) {
    try {
      if (!this.shouldSyncTab(tab)) {
        throw new Error('Tab is not syncable');
      }

      console.log(`Syncing tab to Canvas: ${tab.title} (${tab.url})`);

      // Convert tab to Canvas document format
      const document = this.convertTabToDocument(tab, browserIdentity);

      // Send to Canvas API (use insertDocument with feature array)
      const response = await apiClient.insertDocument(
        contextId,
        document,
        document.featureArray
      );

      if (response.status === 'success') {
        // Mark tab as synced
        this.markTabAsSynced(tab.id, response.payload?.id);

        console.log(`Tab synced successfully: ${tab.title}`);
        return {
          success: true,
          documentId: response.payload?.id,
          message: 'Tab synced to Canvas'
        };
      } else {
        throw new Error(response.message || 'Failed to sync tab');
      }
    } catch (error) {
      console.error('Failed to sync tab to Canvas:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Open a Canvas document as a browser tab
  async openCanvasDocument(canvasDoc, options = {}) {
    try {
      if (!canvasDoc.data?.url) {
        throw new Error('Canvas document has no URL');
      }

      console.log(`Opening Canvas document: ${canvasDoc.data.title} (${canvasDoc.data.url})`);

      // Check if tab is already open
      const existingTabs = await this.findDuplicateTabs(canvasDoc.data.url);
      if (existingTabs.length > 0 && !options.allowDuplicates) {
        // Focus existing tab instead
        const existingTab = existingTabs[0];
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.windows.update(existingTab.windowId, { focused: true });

        return {
          success: true,
          tab: existingTab,
          message: 'Focused existing tab'
        };
      }

      // Open new tab
      const tab = await this.openTab(canvasDoc.data.url, {
        active: options.active !== false,
        pinned: canvasDoc.data.pinned || false
      });

      // Mark as synced
      this.markTabAsSynced(tab.id, canvasDoc.id);

      console.log(`Canvas document opened successfully: ${canvasDoc.data.title}`);
      return {
        success: true,
        tab,
        message: 'Canvas document opened'
      };
    } catch (error) {
      console.error('Failed to open Canvas document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Bulk sync multiple tabs
  async syncMultipleTabs(tabs, apiClient, contextId, browserIdentity) {
    const results = [];

    for (const tab of tabs) {
      const result = await this.syncTabToCanvas(tab, apiClient, contextId, browserIdentity);
      results.push({
        tab,
        result
      });
    }

    const successful = results.filter(r => r.result.success).length;
    console.log(`Bulk sync completed: ${successful}/${tabs.length} tabs synced`);

    return {
      success: successful > 0,
      total: tabs.length,
      successful,
      failed: tabs.length - successful,
      results
    };
  }

  // Remove Canvas document (and optionally close browser tab)
  async removeCanvasDocument(canvasDoc, apiClient, contextId, closeTab = false) {
    try {
      console.log(`Removing Canvas document: ${canvasDoc.data?.title}`);

      // Remove from Canvas
      const response = await apiClient.deleteDocument(contextId, canvasDoc.id);

      if (response.status === 'success') {
        // Optionally close browser tab
        if (closeTab && canvasDoc.data?.url) {
          const matchingTabs = await this.findDuplicateTabs(canvasDoc.data.url);
          for (const tab of matchingTabs) {
            if (this.isTabSynced(tab.id)) {
              await this.closeTab(tab.id);
            }
          }
        }

        return {
          success: true,
          message: 'Canvas document removed'
        };
      } else {
        throw new Error(response.message || 'Failed to remove document');
      }
    } catch (error) {
      console.error('Failed to remove Canvas document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
export const tabManager = new TabManager();
export default tabManager;
