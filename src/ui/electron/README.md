# Canvas Electron UI

The Canvas Electron UI is a desktop application for Canvas, a cross-platform desktop overlay to help organize work, workflows and data into separate "contexts".

## Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build the application
npm run build

# Start the Electron application
npm start
```

## Authentication Troubleshooting

The application requires proper authentication to connect to the Canvas server. If you encounter authentication issues, try the following steps:

1. **Check Config Location**: The authentication token should be in the `server.auth.token` location in the config file at `~/.canvas/config/canvas-electron.json`.

2. **Fix Config Structure**: Run the `scripts/fix-config-token.js` script to ensure the token is in the correct location:
   ```bash
   node scripts/fix-config-token.js
   ```

3. **Test WebSocket Connection**: Use the `scripts/test-websocket.js` script to directly test WebSocket connectivity:
   ```bash
   node scripts/test-websocket.js
   ```

4. **Verify Auth Token**: Run the `scripts/check-auth-token.js` script to check your authentication token:
   ```bash
   node scripts/check-auth-token.js
   ```

5. **Check Browser DevTools**: Open the Electron DevTools in the application (Ctrl+Shift+I or Cmd+Option+I) and check the console for authentication-related errors.

6. **Server Status**: Ensure that the Canvas Server is running on the expected URL (default: http://localhost:8001).

## Token Configuration Structure

The proper configuration structure in `~/.canvas/config/canvas-electron.json` should be:

```json
{
  "server": {
    "url": "http://localhost:8001",
    "auth": {
      "type": "token",
      "token": "YOUR_JWT_TOKEN"
    }
  },
  // ... other config properties
}
```

## Common Issues

1. **WebSocket Authentication Failure**: If you see "No auth token found in socket handshake" in the logs, make sure the token is correctly placed in `server.auth.token`.

2. **Token Structure**: Ensure the token is a valid JWT token without the "Bearer " prefix.

3. **Empty Token**: If the token is empty or missing, try resetting the config using the main process IPC handler `config:reset`.

4. **Cached Token**: The application caches the token for performance. Clear the token cache by restarting the application after making changes to the config file.

## WebSocket Connection Troubleshooting

If you're experiencing issues with WebSocket connections or authentication, try the following steps:

1. **Verify Electron API Initialization**: Check the developer console (Ctrl+Shift+I) for any errors related to "electronAPI" not being available. If you see these errors, try:
   - Restarting the application
   - Checking that the preload script is being loaded correctly
   - Looking for any errors in the Electron main process logs

2. **Token Format Issues**: The WebSocket authentication requires the token to be a raw JWT token without the "Bearer" prefix. Make sure:
   - Your token in the config file is a valid JWT (should have 3 parts separated by dots)
   - The token is not prefixed with "Bearer"
   - The token has not expired

3. **Run Diagnostic Scripts**: The application comes with several diagnostic scripts to help troubleshoot connection issues:
   ```bash
   # Test direct WebSocket connectivity
   node scripts/test-websocket.js
   
   # Check your configuration file and auth token
   node scripts/view-token.js
   
   # Try different WebSocket connection methods
   node scripts/debug-websocket.js
   ```

4. **Check Server Logs**: Look at the Canvas server logs for authentication errors like:
   - "jwt malformed" (suggests an invalid token format)
   - "Authentication failed: Valid user not found" (suggests token validation issues)

5. **Reconnection Issues**: If the application frequently disconnects and reconnects:
   - Make sure no other instances of the app are running
   - Check your network stability
   - Try increasing the reconnection attempt limits in socket.ts 

## Configuration with Electron Store

This application uses [electron-store](https://github.com/sindresorhus/electron-store) to manage configuration data. The configuration is stored in JSON format in the user's home directory:

- Windows: `%USERPROFILE%\AppData\Roaming\canvas-electron\config.json`
- macOS: `~/Library/Preferences/canvas-electron.json`
- Linux: `~/.config/canvas-electron.json`

The configuration schema includes:

```json
{
  "server": {
    "url": "http://localhost:8001",
    "auth": {
      "type": "token",
      "token": "YOUR_JWT_TOKEN"
    }
  },
  "expandedNodes": []
}
```

### Manually Editing Configuration

If you need to manually edit the configuration:

1. Stop the Electron application
2. Edit the JSON file at the path mentioned above
3. Restart the application

### Programmatic Access

In the application code, configuration can be accessed using the `config` module:

```typescript
import config from './lib/config';

// Get the auth token
const token = await config.getAuthToken();

// Set the auth token
await config.setAuthToken('new-token-value');

// Get server URL
const url = await config.getServerUrl();

// Get/save expanded nodes state
const expandedNodes = await config.getExpandedNodes();
await config.saveExpandedNodes(['node1', 'node2']);
```
