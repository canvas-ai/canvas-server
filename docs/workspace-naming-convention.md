# Workspace Naming Convention

## Overview

Canvas uses a structured naming convention for workspaces that supports both local and remote workspace references. This convention enables workspace portability, sharing, and future federation capabilities.

## Format

```
[user.id]@[host]:[workspace_slug][/optional_path...]
```

### Components

- **user.id**: User identifier (must be user.id, NOT user.email to avoid parsing ambiguity)
- **host**: Host identifier (e.g., `canvas.local`, `remote.server.com`)
- **workspace_slug**: Workspace name/slug (filesystem-safe identifier)
- **optional_path**: Optional path within the workspace for sub-contexts

### Examples

```
user123@canvas.local:my-project
user456@canvas.local:shared-workspace
user789@remote.server.com:collaboration-space/subfolder
```

### Important: User ID Requirements

**✅ Allowed**: `user123@canvas.local:my-project`
**❌ Not Allowed**: `user@domain.com@canvas.local:my-project`

User identifiers in workspace references must be user.id values, not user.email addresses. This prevents parsing ambiguity since email addresses contain `@` symbols that would conflict with the reference format.

## Default Host

- **Local workspaces**: `canvas.local`
- **Remote workspaces**: Custom host names (e.g., `company.canvas.com`)

## Internal Storage

### Index Keys

Workspaces are stored internally using a double-colon separator to avoid conflicts with Conf's nested object interpretation:

```
user123::CsEHlodqNfMp
user@domain.com::2RKU9lEFg93n
```

### Index Structure

```javascript
{
  "user123::CsEHlodqNfMp": {
    "id": "CsEHlodqNfMp",
    "name": "my-project",
    "owner": "user123",
    "host": "canvas.local",
    "reference": "user123@canvas.local:my-project",
    "rootPath": "/path/to/workspace",
    "configPath": "/path/to/workspace/workspace.json",
    "status": "available",
    // ... other properties
  }
}
```

## API Methods

### Workspace Manager Methods

#### `parseWorkspaceReference(workspaceRef)`
Parses a workspace reference string into components.

```javascript
const parsed = workspaceManager.parseWorkspaceReference('user123@canvas.local:my-project');
// Returns: {
//   userId: 'user123',
//   host: 'canvas.local',
//   workspaceSlug: 'my-project',
//   path: '',
//   full: 'user123@canvas.local:my-project',
//   isLocal: true,
//   isRemote: false
// }
```

#### `constructWorkspaceReference(userId, workspaceSlug, host, path)`
Constructs a workspace reference string from components.

```javascript
const ref = workspaceManager.constructWorkspaceReference('user123', 'my-project');
// Returns: 'user123@canvas.local:my-project'
```

#### `resolveWorkspaceId(userId, workspaceName, host)`
Resolves a workspace ID from user ID and workspace name.

```javascript
const workspaceId = workspaceManager.resolveWorkspaceId('user123', 'my-project');
// Returns: 'CsEHlodqNfMp'
```

#### `resolveWorkspaceIdFromReference(workspaceRef)`
Resolves a workspace ID from a full workspace reference.

```javascript
const workspaceId = workspaceManager.resolveWorkspaceIdFromReference('user123@canvas.local:my-project');
// Returns: 'CsEHlodqNfMp'
```

### Opening Workspaces

The `openWorkspace` method supports multiple identifier formats:

```javascript
// By workspace ID
const workspace = await workspaceManager.openWorkspace('user123', 'CsEHlodqNfMp', 'user123');

// By workspace name
const workspace = await workspaceManager.openWorkspace('user123', 'my-project', 'user123');

// By full reference
const workspace = await workspaceManager.openWorkspace('user123', 'user123@canvas.local:my-project', 'user123');
```

## Migration from Legacy Format

### Legacy Format
```
user123/my-project  (using / separator)
user123|my-project  (using | separator)
```

### New Format
```
user123@canvas.local:my-project
```

### Migration Process

1. **Backward Compatibility**: The system maintains backward compatibility during transition
2. **Index Rebuilding**: Existing workspaces are automatically migrated to the new format
3. **Reference Generation**: Legacy workspaces get reference properties added automatically

## Benefits

### 1. **Unambiguous Parsing**
Using user.id instead of user.email eliminates parsing ambiguity:
```
user123@canvas.local:my-project ✅ Clear parsing
user@company.com@canvas.local:my-project ❌ Ambiguous parsing
```

### 2. **Remote Workspace Support**
Enables future federation with remote Canvas instances:
```
user123@remote.canvas.com:shared-project
```

### 3. **Path Support**
Supports sub-contexts within workspaces:
```
user123@canvas.local:my-project/reports/2024
```

### 4. **Portability**
Workspaces can be referenced consistently across different Canvas instances.

### 5. **Conflict Resolution**
The `::` separator in internal storage avoids conflicts with Conf's nested object interpretation.

## Implementation Details

### Parser Logic

The parser handles email addresses by:
1. Finding the last `@` before the first `:`
2. Splitting userid from host at that point
3. Parsing workspace slug and optional path after `:`

### Index Management

- **Primary Index**: `userId::workspaceId` → workspace data
- **Name Index**: `userId@host:workspaceName` → workspaceId
- **Reference Index**: Full reference → workspaceId

### Storage Backend

Uses Conf with `accessPropertiesByDotNotation: false` to ensure flat key storage without nested object interpretation.

## Testing

Run the comprehensive test suite:

```bash
node tests/workspace-naming-convention-test.js
```

The test covers:
- Workspace creation with new naming convention
- Reference parsing and construction
- Workspace resolution by different identifiers
- Opening workspaces with multiple formats
- Index key format validation
- Workspace removal and cleanup

## Future Enhancements

1. **Federation Support**: Enable workspace sharing across Canvas instances
2. **DNS-based Discovery**: Resolve Canvas hosts via DNS
3. **Workspace Synchronization**: Sync workspaces between local and remote instances
4. **Access Control**: Fine-grained permissions for remote workspace access 
