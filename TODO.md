# Browser extension

Optional sync settings
Sync only tabs for the current browser [toggle] -> you add client/app/browser-identity-string to the featureArray when fetching tabs
Sync only tabs with tag: [tag] -> you add custom/tag/<tag> to both, when storing and

Context tree refactor
- Standard FS methods: Cut/Copy/Paste/Remove/Delete + MergeUp/MergeDown
- Cut
- Copy
- Paste
- Remove
- Delete
- MergeUp (this will merge the bitmap of "foo" in /work/foo/bar/baz to bar and baz)
- MergeDown (this will merge the bitmap of "foo" in /work/mb/foo to work and mb)
- SubtractUp (subtracts the current bitmap "foo" in "/work/foo/bar/baz" from bar and baz)
- SubtractDown (subtracts the current bitmap "foo" in "/work/mb/foo" from work and mb)


It should also be possible to drag+drop documents from the document table view to the tree folders directly(copy) or drag+drop holding shift for move

API routes

/workspaces/:workspace_id/tree/paths/merge-up
/workspaces/:workspace_id/tree/paths/merge-down
/workspaces/:workspace_id/tree/paths/subtract-up
/workspaces/:workspace_id/tree/paths/subtract-down

/paths/move
    from: string
    to: string
    recursive: bool
    
/paths/copy
    from: string
    to: string
    recursive: bool
    



Generic
- Right click on tab > Move to (Context tree for the current workspace)
- Popup > Right click on tab entry > Move to (Context tree for the current workspace)

# Server


## SynapsD

- Add backup policy, backup DB every day at 2AM server time, keep 7 days of backups(default, configurable for each workspace, config in workspace.json at each workspace path, should work on an active workspace only)
- Add backup/restore functionality internally (full db backup/restore, we'll implement snapshoting for undo/redo ops later)
- Add pagination support!
- Check/Fix MergeUp/Down functionality
- Implement subractUp/subtractDown (untick all bitmaps of layer l from all layers above or below)

## API

- Fix response object mess-up! De-matriyoshka the pyaload
- Add a workspaces/:wid/db endpoint
  - /stats
  - /status
  - /dump
  - /snapshots
    - /timestamp
      - /dump
      - /restore

## Dotfile Manager

- Re-think > re-work the indexing scheme
- Simplify the CLI
- gitea test with a push and/or pull repo config

# WebUI

Close tab (closing a single tab) should not deselect all previously selected items in the popup nor delete tab
Sync selected should also not deactivate the selection, so that we can use Close selected right after sync

SyncEngine: Already fetching documents for context:default - skipping duplicate request
For fast changes of context this is a problem

## This repo

- Remove unnecessary submodules, create / reuse our "canvas" repo for development across multiple modules instead, server should link to canvas-web only
- Remove old/stale code
- Cleanup README.md
- Test/fix Dockerfile / docker-compose

## Architectural changes

- Integrate stored into synapsd
- Use https://unstorage.unjs.io/ instead of a custom lmdb wrapper?, in worst cases we can write a small lmdb driver for unstorage if we'll feel its justified

## Utils/config

- Use consistently across the canvas-server app
- fix the config class to properly normalize paths(windoze + *nix)
- Remove user + server priority logic, does not make sense in the current setup

## Context handling

- Support contexts on top of remote workspaces
- We need to ensure
  - Context layers will get locked when open in a context
  - Layers will need to have a in-memory map of userid/contextid locks - brrr complexity

## Workspaces

- Add back import/export functionality
  - add support for documents, bitmaps, agents, roles, dotfiles

- Config file search paths?
```text
Workspace config paths
    $WORKSPACE_ROOT/.canvas/config/workspace.json
    $WORKSPACE_ROOT/.canvas/workspace.json
    $WORKSPACE_ROOT/.workspace.json
    $WORKSPACE_ROOT/workspace.json

    workspace directories relative to the workspace.json location
```

## Global

- !!! SIMPLIFY (as in, make things as simple as possible but not simpler)

