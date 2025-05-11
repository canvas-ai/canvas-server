# TODO

## Architectural changes

- Integrate stored into synapsd
- Use https://unstorage.unjs.io/ instead of a custom lmdb wrapper, in worst cases we can write a small lmdb driver for unstorage if we'll feel its justified

## Utils/config

- fix the config class to properly normalize paths(windoze + *nix)
- Remove user + server priority logic

## Context handling

- We need to ensure 
  - Context layers will get locked when open in a context
  - Layers will need to have a in-memory map of userid/contextid locks

## Workspaces

```text
Workspace config paths
    $WORKSPACE_ROOT/.canvas/config/workspace.json
    $WORKSPACE_ROOT/.canvas/workspace.json
    $WORKSPACE_ROOT/.workspace.json
    $WORKSPACE_ROOT/workspace.json
    
    workspace directories relative to the workspace.json location!
```

## Global

- streamline the IDs used across managers (user-prefix is currently a mix of user.email and user.id)
- !!! SIMPLIFY
- !!! SIMPLIFY
- !!! SIMPLIFY

## Workspace Manager

- Prevent changing main properties of a Universe workspace
