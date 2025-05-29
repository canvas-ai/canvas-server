# Canvas Server Tests

This directory contains test scripts and utilities for testing Canvas Server functionality.

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

The WebSocket API now includes document events in the list of forwarded events, ensuring connected clients receive real-time notifications.

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

Browser extension behavior can be configured through the sync settings:

- `autoOpenCanvasTabs` - Whether to automatically open tabs for inserted documents
- `tabBehaviorOnContextChange` - How to handle existing tabs when context changes ("Close", "Save and Close", "Keep") 
