# TODO

## Utils/config

- fix the config class to properly normalize paths(windoze + *nix)
- Remove user + server priority logic

## Workspaces

```text
Workspace config paths
    $WORKSPACE_ROOT/.canvas/config/workspace.json
    $WORKSPACE_ROOT/.canvas/workspace.json
    $WORKSPACE_ROOT/.workspace.json
    $WORKSPACE_ROOT/workspace.json
    
    workspace directories relative to the workspace.json location!
```

- Reconsider initializing workspace and context managers globally, adding userID as a parameter for each
- Current setup was meant for scenarios where each user environment would run in a separate container
  - This setup could be achieved by reverting to the old design where canvas-server was a single-user application
  - We'd create a orchestrator on top, question is whether to do it on a per user or per workspace basis
  - User can have his data directory accessible via webdav and/or s3, his dotfiles accessible over a ssh+git
  - We aim for a roaming profile setup, 
  ! DAMN

OK plan for today(20.4.25)

- update contextManager(keep as a global - as in not user-scoped - manager), store contexts in a ID -> ctx map with composite keys (user.email/context.id) with persistence in CANVAS_SERVER_DB/contexts.json
  - On module start, we'll
- update workspaceManager(keep as global), store a map of workspaces as id -> ws with persistence in CANVAS_SERVER_DB/workspaces.json, composite keys(user.email/workspace.name);
  - On start of the module, we'll loop through the index, mark workspaces based on whether the path is found and contains a valid workspace(config)
  - createWorkspace(name, rootPath = this.#rootPath, options = {})
    - rootPath can be relative or absolute or contain {{ CANVAS_SERVER_ }}  .. wait, strike that, KISS
  - we'll need a private method #resolveWorkspacePath(path)
  - we'll need a single private method to #loadWorkspaceConfig(workspaceRootPath)
    - possible workspace paths to accommodate the 2 most common use-cases:
      - $WORKSPACE_ROOT/.workspace/workspace.json
        - Suited if you want to convert an existing directory to a workspace leaving all its current data in-tact, all workspace folders will be placed within .workspace/
      - $WORKSPACE_ROOT/.workspace.json
        - Same as above, we'll create a .workspace folder and place all our directories within it
      - $WORKSPACE_ROOT/workspace.json
        - Default vanilla workspace
- User class will be a mere abstraction on top of CM and WM => listWorkspaces(), listContexts() will call this.#cm / this.#wm list* methods with this.id
  - Well, not entirely, we will only initialize workspaces when a user logs-in (universe automatically, the rest on demand), same for contexts
- We should move tokenManager out of the User class!
