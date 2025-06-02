# Canvas Server Tests

This directory contains test scripts and utilities for testing Canvas Server functionality.

## Critical Fix: WebSocket Document Event Broadcasting

### Problem Identified

The Canvas system had a critical issue where **document events were not being broadcasted to connected clients** (like browser extensions). The event chain was broken at the WebSocket layer:

- ✅ Context class properly emitted `document:insert`, `document:update`, etc. events
- ✅ ContextManager forwarded events from individual contexts to manager level  
- ✅ Browser extension had proper event handlers ready
- ❌ **Missing**: WebSocket broadcasting system to actually send events to connected clients

### Root Cause

The `src/api/websocket/index.js` file had broadcast methods (`broadcastToUser`, `broadcastToContext`) but **no event listeners** connecting the ContextManager events to these broadcast methods.

### Solution Implemented

Added ContextManager event listeners in `src/api/websocket/index.js` that:
1. Listen for document events from ContextManager
2. Check user permissions for each context
3. Broadcast events to all connected clients who have access
4. Log broadcasting activity for debugging

**Code Added:**
```javascript
// Set up ContextManager event listeners for broadcasting
if (fastify.contextManager) {
  const contextManager = fastify.contextManager;
  
  // Document events - broadcast to all users who have access to the context
  const documentEvents = [
    'document:insert', 'document:update', 'document:remove', 
    'document:delete', 'documents:delete'
  ];

  documentEvents.forEach(eventType => {
    contextManager.on(eventType, async (payload) => {
      const contextId = payload.contextId || payload.id;
      if (contextId) {
        // Find all users who have access to this context and broadcast to them
        for (const [socketId, connection] of connections.entries()) {
          const hasAccess = await contextManager.hasContext(connection.user.id, contextId);
          if (hasAccess) {
            connection.socket.emit(eventType, payload);
          }
        }
      }
    });
  });
}
```

## Full Event Chain Integration Test

### Overview

The `full-event-chain-test.js` script provides end-to-end verification that document events flow correctly through the complete system:

**Event Flow:** CLI → Context → ContextManager → WebSocket Broadcasting → Browser Extension

### What it tests

1. **Authentication** - Verifies user can authenticate with the Canvas server
2. **WebSocket Connection** - Establishes authenticated WebSocket connection
3. **Document Insertion** - Simulates CLI adding a document with URL
4. **Event Broadcasting** - Verifies events are broadcasted to connected clients
5. **Browser Extension Simulation** - Simulates browser extension receiving and handling events

### Running the Test

```bash
# Ensure server is running on port 3000
npm start

# In another terminal, run the integration test
node tests/full-event-chain-test.js
```

### Expected Output

```
🧪 Starting Full Event Chain Integration Test
   Testing document event flow from CLI to Browser Extension

🔐 Step 1: Authenticating user...
   ✅ User authenticated successfully

🌐 Step 2: Setting up WebSocket connection...
   ✅ WebSocket connected successfully
   ✅ WebSocket authenticated for user: test@canvas.local

📝 Step 3: Inserting document via CLI API (simulating CLI call)...
   📄 Inserting document: Test Document from CLI
   🌐 Document URL: https://example.com/test-document
   ✅ Document inserted successfully via CLI API

🔌 Browser Extension: Received document:insert event!
   📋 Event payload: {
     "contextId": "testcontext",
     "operation": "insert",
     "documentId": 123456,
     "document": { "url": "https://example.com/test-document", ... },
     ...
   }
   🌐 Browser Extension: Would auto-open tabs for URLs:
      - https://example.com/test-document
   ✅ Document insert event handled successfully!

✅ Full Event Chain Integration Test PASSED!
```

## Document Events Test

### Overview

The `document-events-test.js` script tests the document event forwarding chain that enables real-time synchronization between different Canvas applications (like browser extensions).

### What it tests

The test verifies that document events are properly emitted and forwarded through the complete event chain:

1. **Context Class** → Emits document events (`document:insert`, `document:update`, etc.)
2. **ContextManager** → Forwards events from individual contexts to the manager level
3. **WebSocket API** → Forwards events to connected clients
4. **Browser Extension** → Receives and handles events appropriately

### Event Types

The following document events are supported:

- `document:insert` - When documents are added to a context
- `document:update` - When documents are modified
- `document:remove` - When documents are removed from a context (but not deleted)
- `document:delete` - When documents are permanently deleted from the database
- `documents:delete` - When multiple documents are permanently deleted

### Event Payload Structure

Each document event includes comprehensive information:

```javascript
{
  contextId: "context-id",
  operation: "insert|update|remove|delete",
  documentId: 12345,           // For single document operations
  documentIds: [12345, 67890], // For batch operations
  document: { /* document data */ },     // For insert/update operations
  documents: [/* document array */],     // For batch operations
  contextArray: ["path", "segments"],
  featureArray: ["web", "url"],
  url: "universe:///context/path",
  workspaceId: "workspace-id",
  timestamp: "2025-05-29T14:20:28.291Z"
}
```

### Running the Test

```bash
# From the project root
node tests/document-events-test.js
```

### Expected Output

The test should show the complete event flow:

```
🧪 Starting Document Events Test
📋 Test Setup Complete
🔬 Testing Document Insertion...
📄 Context: Emitting document:insert event
🔄 ContextManager: Forwarding document:insert event
🌐 WebSocket API: Forwarding document:insert event to clients
🔌 Browser Extension: Received document:insert event
   📋 Payload: { /* event payload */ }
   🌐 Browser Extension: Would open tabs for URLs: [ 'https://example.com' ]
   ✅ Browser Extension: Document insert event handled successfully
✅ Document Events Test Completed Successfully!
```

## Implementation Details

### Context Class Changes

The Context class now emits comprehensive document events with all necessary information for clients to make informed decisions about what actions to take.

### ContextManager Changes

The ContextManager now forwards document-specific events from individual contexts to the manager level, ensuring all context events are accessible at the manager level.

### WebSocket API Changes

The WebSocket API now includes:
1. Document events in the list of forwarded events for individual socket connections
2. **NEW**: Global ContextManager event listeners that broadcast to all connected clients
3. Permission checking to ensure only authorized users receive context events

### Browser Extension Changes

The browser extension now includes handlers for document events that:

- Check if events are for the current context
- Automatically open new tabs for inserted documents (if configured)
- Update local tabs data to stay in sync
- Provide user feedback about document operations

## Use Cases

This event system enables:

1. **Real-time tab synchronization** - Browser extensions can automatically open tabs when documents with URLs are added from other applications
2. **Cross-application awareness** - Different Canvas applications can stay synchronized with document changes
3. **User feedback** - Applications can provide immediate feedback about document operations
4. **Conflict resolution** - Applications can detect and handle conflicting operations

## Configuration

Browser extension auto-open behavior is controlled by the `autoOpenCanvasTabs` configuration setting:

```javascript
// In browser extension config
{
  sync: {
    autoOpenCanvasTabs: true  // Enable automatic tab opening for new URL documents
  }
}
```

## Troubleshooting

### Document Events Not Received

1. **Check WebSocket Connection**: Ensure browser extension is connected to WebSocket
2. **Verify Authentication**: Ensure user is properly authenticated
3. **Check Context Access**: Ensure user has access to the context where documents are being added
4. **Check Server Logs**: Look for broadcasting messages in server logs:
   ```
   [WebSocket] Broadcasting document:insert event for context contextId
   [WebSocket] Document event document:insert broadcasted to N connected users
   ```

### Auto-Open Tabs Not Working

1. **Check Configuration**: Ensure `autoOpenCanvasTabs` is set to `true`
2. **Check Document URLs**: Ensure documents have valid `url` properties
3. **Check Event Payload**: Verify `document:insert` events contain URL documents
4. **Check Browser Permissions**: Ensure browser extension has tab creation permissions

### Testing Event Chain

Use the provided test scripts to verify each part of the event chain:

```bash
# Test basic event forwarding
node tests/document-events-test.js

# Test full integration with real server
node tests/full-event-chain-test.js
```
