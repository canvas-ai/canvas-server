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

- Reconsider initializing workspace and context managers globally, adding userID as a parameter for each
- Current setup was meant for scenarios where each user environment would run in a separate container
  - This setup could be achieved by reverting to the old design where canvas-server was a single-user application
  - We'd create a orchestrator on top, question is whether to do it on a per user or per workspace basis
  - User can have his data directory accessible via webdav and/or s3, his dotfiles accessible over a ssh+git
  - We aim for a roaming profile setup, 
