# Event Naming Best Practices for Complex Applications

## The Core Question: Source-Based vs. Aggregated Prefixes

You've identified a fundamental architectural decision: Should events be named based on their **actual source** (like `db:document:inserted`) or use **aggregated prefixes** that reflect the abstraction layer (like `context:document:insert`)?

## Industry Best Practices Analysis

### 1. **Source-Based Naming (Recommended for Complex Systems)**

```javascript
// Database layer events
db:document:inserted
db:document:updated  
db:document:deleted

// Workspace layer events (forwarding db events + workspace context)
workspace:document:inserted
workspace:tree:document:inserted

// Context layer events (forwarding workspace events + context filtering)
context:workspace:document:inserted
```

**Pros:**
- **Clear Origin**: Always know exactly where an event originated
- **Debugging**: Easy to trace event flow through layers
- **Separation of Concerns**: Each layer has distinct event namespace
- **Scalability**: New layers can be added without naming conflicts

**Cons:**
- **Verbosity**: Event names can become long
- **Client Complexity**: Clients need to know which layer to listen to

### 2. **Aggregated Prefix Approach**

```javascript
// All document events use same prefix regardless of source
document:inserted
document:updated
document:deleted

// Or context-scoped
context:document:inserted
context:document:updated
```

**Pros:**
- **Simplicity**: Shorter, cleaner event names
- **Client Convenience**: Easy to listen to all document events
- **Abstraction**: Hides implementation details

**Cons:**
- **Loss of Context**: Hard to know which layer emitted the event
- **Debugging Difficulty**: Event flow becomes opaque
- **Naming Conflicts**: Different layers might emit same event name

## EventEmitter2 Wildcard Patterns

Your insight about using wildcards is spot-on. Here are the patterns:

### Pattern 1: Source-Based with Wildcards
```javascript
// Listen to ALL database events
emitter.on('db:**', handler);

// Listen to ALL document events from ANY source
emitter.on('*:document:*', handler);

// Listen to ALL workspace events
emitter.on('workspace:**', handler);

// Listen to specific document operations from ANY source
emitter.on('*:document:inserted', handler);
```

### Pattern 2: Hierarchical Namespacing
```javascript
// Database events
db.document.inserted
db.document.updated
db.tree.document.inserted

// Workspace events  
workspace.document.inserted
workspace.tree.document.inserted

// Context events
context.workspace.document.inserted
```

## Recommended Architecture for Canvas

Based on your system's complexity, I recommend **Source-Based Naming with Hierarchical Structure**:

### Event Naming Convention

```
{source}:{object}:{action}[:{detail}]
```

### Examples

```javascript
// Database layer (SynapsD)
'db:document:inserted'
'db:document:updated'
'db:document:deleted'

// Workspace layer
'workspace:document:inserted'      // Forwarded from db + workspace context
'workspace:tree:document:inserted' // Tree-specific operations

// Context layer  
'context:workspace:document:inserted'  // Forwarded from workspace + context filtering
'context:document:inserted'            // Direct context operations

// Manager layer
'contextManager:context:created'
'workspaceManager:workspace:started'
```

### Wildcard Listening Patterns

```javascript
// Context listens to its workspace
context.on('workspace:**', handler);

// Browser extension listens to context events
socket.on('context:**', handler);

// Listen to ALL document insertions regardless of source
emitter.on('*:document:inserted', handler);

// Listen to ALL events from database
emitter.on('db:**', handler);
```

## Implementation Strategy

### 1. **Layer-Specific Event Emitters**

```javascript
class Context extends EventEmitter2 {
  constructor() {
    super({ wildcard: true, delimiter: ':' });
    
    // Listen to workspace events and re-emit with context prefix
    this.workspace.on('**', (data) => {
      const originalEvent = this.workspace.event;
      this.emit(`context:workspace:${originalEvent}`, {
        contextId: this.id,
        ...data
      });
    });
  }
  
  insertDocument(doc) {
    // Direct context operation
    this.emit('context:document:insert', { document: doc });
    
    // Delegate to workspace (which will emit workspace:document:inserted)
    return this.workspace.insertDocument(doc);
  }
}
```

### 2. **Unified Event Router**

```javascript
class EventRouter extends EventEmitter2 {
  constructor() {
    super({ wildcard: true, delimiter: ':' });
  }
  
  // Route events based on patterns
  route(pattern, handler) {
    this.on(pattern, handler);
  }
  
  // Forward events from multiple sources
  forwardFrom(emitter, prefix = '') {
    emitter.on('**', (data) => {
      const event = prefix ? `${prefix}:${emitter.event}` : emitter.event;
      this.emit(event, data);
    });
  }
}

// Usage
const router = new EventRouter();
router.forwardFrom(database, 'db');
router.forwardFrom(workspace, 'workspace');
router.forwardFrom(context, 'context');

// Clients listen to router
router.on('*:document:inserted', handleAnyDocumentInsert);
router.on('db:document:inserted', handleDbDocumentInsert);
```

## Best Practices Summary

### 1. **Use Source-Based Prefixes**
- `db:`, `workspace:`, `context:`, `manager:`
- Makes debugging and tracing much easier

### 2. **Consistent Structure**
- `{source}:{object}:{action}[:{detail}]`
- Always use same delimiter (`:`)

### 3. **Leverage EventEmitter2 Wildcards**
- `**` for all events from a source
- `*:document:*` for all document events
- `context:workspace:**` for all workspace events via context

### 4. **Event Forwarding Pattern**
```javascript
// Lower layer emits: db:document:inserted
// Higher layer forwards as: workspace:document:inserted
// Even higher layer forwards as: context:workspace:document:inserted
```

### 5. **Client Listening Strategy**
```javascript
// Specific listening
socket.on('context:workspace:document:inserted', handler);

// Wildcard listening  
socket.on('context:**', handler);           // All context events
socket.on('*:document:inserted', handler);  // All document insertions
```

## Your Specific Use Case

For Canvas, I recommend:

```javascript
// Database events (SynapsD)
db:document:inserted
db:document:updated

// Workspace events (forwarded + workspace context)
workspace:document:inserted
workspace:tree:document:inserted

// Context events (forwarded + context filtering)  
context:workspace:document:inserted
context:document:inserted  // Direct context operations

// Browser extension listens to
socket.on('context:**', handler);  // All context-related events
socket.on('*:document:inserted', handler);  // Any document insertion
```

This gives you:
- **Clear event origin** for debugging
- **Flexible listening** with wildcards  
- **Proper abstraction** layers
- **Easy filtering** by context/workspace
- **Future extensibility**

The key insight is that **source-based naming with wildcard listening** gives you the best of both worlds: clarity about event origin while maintaining client convenience through pattern matching. 
