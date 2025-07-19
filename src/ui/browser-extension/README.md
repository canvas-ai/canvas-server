# Canvas Browser Extension v2.0

A browser extension for seamlessly syncing browser tabs with Canvas server contexts.

## Features

- **Real-time synchronization** between browser tabs and Canvas server contexts
- **Configurable sync behaviors** (auto-sync new tabs, auto-open context tabs, etc.)
- **Context binding** for organizing tabs by project/workspace
- **Cross-browser support** (Chromium-based browsers & Firefox)
- **WebSocket integration** for live updates
- **Secure API token authentication**

## Installation

### Development Installation

1. **Install dependencies** (from browser extension directory):
   ```bash
   cd src/ui/browser-extension
   npm install
   ```

2. **Build the extension**:
   ```bash
   # Development build (unminified, with console logs)
   npm run dev
   
   # Production build (minified, optimized)
   npm run build
   ```

3. **Load in browser**:

   **Chromium browsers (Chrome, Edge, Brave, etc.):**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `packages/chromium/` directory

   **Firefox:**
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `packages/firefox/manifest.json` file

4. **Extension logo**: 
   - The extension uses `assets/icons/logo-br_64x64.png` as the main logo
   - This 64x64 Canvas logo works for all icon sizes in the browser

### Production Installation

*Coming soon: Extension will be published to browser stores*

## Setup

1. **Install and run Canvas server** (see main project README)

2. **Generate API token**:
   - Open Canvas web interface (usually http://127.0.0.1:8001)
   - Go to Settings > API Tokens
   - Create new token with appropriate permissions

3. **Configure extension**:
   - Click extension icon in browser toolbar
   - Click Settings button (opens new tab)
   - Enter server URL and API token
   - Test connection and bind to a context

## Usage

### Basic Workflow

1. **Connect to Canvas server** via extension settings
2. **Bind to a context** (or create new one)
3. **Sync tabs** using the popup interface:
   - **Browser → Canvas**: Sync browser tabs to Canvas context
   - **Canvas → Browser**: Open Canvas context tabs in browser

### Popup Interface

- **Connection status**: Green/red indicator showing server connection
- **Search**: Find tabs by title or URL
- **Browser → Canvas**: List of unsynced browser tabs
- **Canvas → Browser**: List of context tabs not open in browser
- **Bulk operations**: Select multiple tabs for batch actions

### Sync Behaviors

Configure in Settings page:

- **Auto-sync new tabs**: Automatically save new browser tabs to Canvas
- **Auto-open context tabs**: Automatically open new context tabs in browser
- **Auto-close removed tabs**: Close browser tabs when removed from context
- **Browser-specific sync**: Only sync tabs from this browser instance
- **Context change behavior**: What to do when switching contexts

## Architecture

```
src/ui/browser-extension/
├── manifest-*.json          # Browser-specific manifests (source)
├── package.json             # Build dependencies and scripts
├── build.mjs                # Build script for packaging
├── src/
│   ├── background/          # Service worker and modules
│   │   ├── service-worker.js
│   │   └── modules/         # Core functionality modules
│   ├── popup/               # Extension popup UI
│   └── settings/            # Settings page UI
├── assets/                  # Icons and static files
├── build/                   # Intermediate build files (esbuild output)
└── packages/                # Final browser packages
    ├── chromium/            # Chrome/Edge ready package
    ├── firefox/             # Firefox ready package
    ├── canvas-extension-chromium.zip
    └── canvas-extension-firefox.zip
```

### Key Components

- **Service Worker**: Background script handling API calls and tab events
- **Storage Manager**: Chrome storage abstraction for settings
- **API Client**: Canvas server REST API communication
- **WebSocket Client**: Real-time updates from Canvas server
- **Tab Manager**: Browser tab operations and document conversion
- **Sync Engine**: Coordination between browser and Canvas

## Development

### File Structure

The extension follows a modular architecture:

- **Background modules** handle core functionality
- **UI components** are separate HTML/CSS/JS files
- **Manifest files** support both Chromium and Firefox

### Adding Features

1. **Background functionality**: Add to appropriate module in `src/background/modules/`
2. **UI features**: Update popup or settings HTML/CSS/JS
3. **API endpoints**: Extend the API client module
4. **Storage**: Use the storage manager for persistent data

### Testing

*Testing framework coming soon*

## Browser Compatibility

- **Chrome**: v88+
- **Edge**: v88+
- **Firefox**: v109+
- **Brave**: v1.20+
- **Opera**: v74+

## Security

- API tokens stored securely via browser storage
- Strict Content Security Policy
- Input validation and sanitization
- HTTPS-only communication in production

## Troubleshooting

### Connection Issues

1. Verify Canvas server is running
2. Check server URL and API token
3. Ensure no firewall blocking connections
4. Try refreshing API token

### Sync Problems

1. Check browser console for errors
2. Verify context is properly bound
3. Restart extension (disable/enable)
4. Clear extension storage and reconfigure

### Performance

- Extension optimized for minimal resource usage
- WebSocket connections auto-retry with backoff
- Efficient tab tracking and updates

## Contributing

See main project CONTRIBUTING.md for guidelines.

## License

See main project LICENSE file. 
