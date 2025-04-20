# Canvas Server Manager Architecture

This document outlines the standardized architecture for all Canvas server managers, explaining how they work with JSON Index Manager (JIM) and how they interact with each other.

## Core Architecture

### Base Manager Class

All managers extend the `Manager` base class, which provides:

- Standardized initialization with JIM dependency
- Consistent event handling
- Lifecycle management
- Configuration storage and retrieval

```javascript
class Manager extends EventEmitter {
    // Core properties
    #initialized = false;
    #jim;
    #index;
    #indexName;
    
    // Standard methods
    initialize() {...}
    start() {...}
    stop() {...}
    
    // Configuration helpers
    getConfig(key, defaultValue) {...}
    setConfig(key, value) {...}
}
```

### JSON Index Manager (JIM)

JIM provides a standardized way to store and retrieve configuration data using the `Conf` library:

- Centralized configuration management
- Consistent file paths
- Transaction safety
- Standard retrieval patterns

## Manager Implementations

### SessionManager

- Manages user sessions
- Stores session data using JIM
- Provides methods for creating, retrieving, and managing sessions
- Handles session cleanup and expiration

### UserManager

- Manages user accounts
- Stores user data using JIM
- Creates Universe workspaces as user homes
- Delegates token management to TokenManager

### WorkspaceManager

- Manages workspace directories
- Stores workspace metadata using JIM
- Handles workspace lifecycle (create, open, close, start, stop)
- Special handling for Universe workspaces

### ContextManager

- User-specific manager (created per user)
- Manages context views across workspaces
- Stores context references using JIM
- Supports cross-workspace navigation

## Directory Structure

```
CANVAS_SERVER_DB/
  ├── sessions.json     # Global session index
  ├── users.json        # Global user index
  ├── tokens.json       # Per-user token indices
  └── workspaces.json   # Global workspace index

CANVAS_SERVER_HOMES/
  ├── <user.email>/     # User Universe workspace (home)
      ├── Config/       # User configuration
      └── Workspaces/   # Nested workspaces

```

## Workspace Structure

Each workspace (including Universe workspaces) has the following standard directories:

```
<workspace-root>/
  ├── Apps/        # Applications
  ├── Cache/       # Cache data
  ├── Config/      # Configuration
  ├── Data/        # User data
  ├── Db/          # Database
  ├── Dotfiles/    # Configuration files
  ├── Home/        # User home files
  ├── Roles/       # Role definitions
  └── Workspaces/  # Nested workspaces
```

## Initialization Flow

1. Server creates the JIM instance
2. Server initializes SessionManager with JIM
3. Server initializes UserManager with JIM
4. Server initializes WorkspaceManager with JIM
5. UserManager is given a reference to WorkspaceManager
6. ContextManager is created per-user as needed

## Dependencies Between Managers

- **UserManager** depends on WorkspaceManager to create Universe workspaces
- **ContextManager** depends on WorkspaceManager to navigate between workspaces
- **Server** creates individual managers and manages their dependencies

## Context Management

Contexts are user-specific views that can span across multiple workspaces. They:

1. Are created per-user
2. Reference workspaces through the WorkspaceManager
3. Store their state using JIM through the ContextManager
4. Support URL-based navigation within and across workspaces

## Key Benefits

- **Standardized Approach**: All managers follow the same patterns
- **Dependency Injection**: Clear dependencies between managers
- **Consistent Storage**: All configuration uses JIM/Conf
- **Clean Separation**: Each manager has a specific responsibility
- **Self-Contained Workspaces**: Workspaces are portable between servers
- **User-Centric Design**: Home directories are Universe workspaces 
