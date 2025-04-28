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

## Global

- create a genId and genIndexId methods on all managers with a internal index
- Make sure all IDs except for sessions are at most 8 character long
- Use Ulid in lowercase(looks nicer)?
- streamline the IDs used across managers (user-prefix is currently a mix of user.email and user.id)
- !!! SIMPLIFY
- !!! SIMPLIFY
- !!! SIMPLIFY
