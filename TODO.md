# TODO

## Utils/config

- fix the config class to properly normalize paths(windoze + *nix)
- Remove user + server priority logic

## Workspaces

```
Workspace config
    $WORKSPACE_ROOT/.canvas/config/workspace.json
    $WORKSPACE_ROOT/.canvas/workspace.json
    $WORKSPACE_ROOT/.workspace.json
    $WORKSPACE_ROOT/workspace.json
    
    workspace directories relative to the workspace.json location!
```   

- Move Tree under Workspaces

- Reconsider initializing workspace and context managers globally, adding userID as a parameter for each
- Current setup was meant for scenarios where each user environment would run in a separate container
  - This setup could be achieved by reverting to the old design where canvas-server was a single-user application
  - We'd create a orchestrator on top, question is whether to do it on a per user or per workspace basis
  - User can have his data directory accessible via webdav and/or s3, his dotfiles accessible over a ssh+git
  - We aim for a roaming profile setup, 


  canvas:user-manager Loading users from database +0ms
  canvas:user-manager Activating user: undefined (undefined) +2ms
  canvas:user-manager Error activating user undefined: User ID is required +0ms
  canvas:user-manager Activating user: undefined (undefined) +0ms
  canvas:user-manager Error activating user undefined: User ID is required +0ms
  canvas:user-manager Activating user: undefined (undefined) +0ms
  canvas:user-manager Error activating user undefined: User ID is required +0ms
  canvas:user-manager Activating user: undefined (undefined) +0ms
  canvas:user-manager Error activating user undefined: User ID is required +0ms
  canvas:user-manager Activating user: undefined (undefined) +0ms
  canvas:user-manager Error activating user undefined: User ID is required +0ms
  canvas:user-manager Activating user: undefined (undefined) +0ms
  canvas:user-manager Error activating user undefined: User ID is required +1ms
  canvas:user-manager Activating user: undefined (undefined) +0ms
  canvas:user-manager Error activating user undefined: User ID is required +0ms
  canvas:user Ensured workspaces directory exists: /home/idnc_sk/Code/Canvas/canvas-server/server/multiverse/testuser1@email.com/workspaces +0ms

  1@email.com/workspaces +0ms
  canvas:user Token store initialized with 0 tokens +1ms
  canvas:user Token store initialized +0ms

    canvas:workspace-manager Failed to open workspace "universe": Cannot set property tree of #<Workspace> which has only a getter +7ms
  canvas:user Error activating user runtime: Failed to open workspace "universe": Cannot set property tree of #<Workspace> which has only a getter +13ms
  canvas:user-manager Error activating user 0d241ee5-c088-467d-8b6f-c82787ce0707: Failed to open workspace "universe": Cannot set property tree of #<Workspace> which has only a getter +0ms
  canvas:user Ensured workspaces directory exists: /home/idnc_sk/Code/Canvas/canvas-server/server/multiverse/test@domain.com/workspaces +0ms

    canvas:workspace-manager Failed to open workspace "universe": Cannot set property tree of #<Workspace> which has only a getter +8ms
