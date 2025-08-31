Add Canvas support
  GET /contexts/:cid/canvases/foo  will create a context-bound canvas within context cid(cid.url) with ID foo
  GET /workspaces/:wid/canvases/foo will create a unbound canvas with contextPath / (or ?contextPath=/foo/bar/baz) with ID "foo"

  canvas IDs have to be unique 

Add Task support
  - Useful for episodic memory / agentic workloads and AI integration
  - Simillar semantics as Canvas


Context
- /documents
- /agents
- /dotfiles
    in-repo index .dot/index
      - repoPath:type:encryption

    local
      - localPath:remotePath:type:encryption

    db
      - localPath:remotePath:type:encryption:priority
    

ctx dotfiles // ctx = /
  ~/.bashrc -> common/shell/bashrc priority 0
  ~/.bashrc -> mb/shell/bashrc priority 1

ctx dotfiles // ctx = /work/mb
  ~/.bashrc -> mb/shell/bashrc


We need to change the interface for Tree operations in

current API
- mergeUp(contextPath): merge the bitmap of layer "foo" in context path "/work/foo/bar/baz" to bitmaps "bar" and "baz"
- mergeDown(contextPath): merge the bitmap of layer "foo" in context path "/work/foo/bar/baz" to bitmap "work"
- subtractUp(contextPath): subtract the bitmap of layer "foo" in context path "/work/foo/bar/baz" from bitmaps "bar" and "baz"
- subtractDown(contextPath): subtract the bitmap of layer "foo" in context path "/work/foo/bar/baz" from bitmap "work"

alternative API
- mergeUp(layerName, contextPath): merge the bitmap of layer "foo" in context path "/work/foo/bar/baz" to bitmaps "bar" and "baz"
- mergeDown(layerName, contextPath): merge the bitmap of layer "foo" in context path "/work/foo/bar/baz" to bitmap "work"
- subtractUp(layerName, contextPath): subtract the bitmap of layer "foo" in context path "/work/foo/bar/baz" from bitmaps "bar" and "baz"
- subtractDown(layerName, contextPath): subtract the bitmap of layer "foo" in context path "/work/foo/bar/baz" from bitmap "work"

SynapsD methods?
- mergeLayer(source, dst|dstArray)
- subtractLayers(source, dst|dstArray)


# WebUI

We should implement a more complex tree-view + data view component resembling a full-fledged file manager.
- Our update workspaces-details interface should support a tree view on the left and a document view on the right(we'll extend the functionality to support multiple open document views for different tree paths later)
- There should be a right side-pane with filters for the current schemas (this we already have, we just nead to streamline it), with additional input fields for custom tags, we should also create a for-now empty tab for Filters
- Interface should support standard FS methods: Cut/Copy/Paste/Remove/Delete + in the tree view MergeUp/MergeDown, SubtractUp/SubtractDown
  - Cut
  - Copy
  - Paste
  - Remove
  - Delete
  - mergeUp(contextPath): merge the bitmap of layer "foo" in context path "/work/foo/bar/baz" to bitmaps "bar" and "baz"
  - mergeDown(contextPath): merge the bitmap of layer "foo" in context path "/work/foo/bar/baz" to bitmap "work"
  - subtractUp(contextPath): subtract the bitmap of layer "foo" in context path "/work/foo/bar/baz" from bitmaps "bar" and "baz"
  - subtractDown(contextPath): subtract the bitmap of layer "foo" in context path "/work/foo/bar/baz" from bitmap "work"

It should also be possible to drag+drop documents from the document table view to the tree folders directly(copy) or drag+drop holding shift for move

API Routes for the currently supported operations
/workspaces/:workspace_id/tree/paths/move
    from: string
    to: string
    recursive: bool
    
/workspaces/:workspace_id/tree/paths/copy
    from: string
    to: string
    recursive: bool
    
    

# Browser extension

Lets pick a couple of low-hanging fruit for the browser extension codebase:
- Close tab (closing a single tab) nor delete tab should not deselect all previously selected items in the popup/
- Sync selected should also not deactivate the selection, so that we can use Close selected right after sync ()

Generic UX improvements(if possible)
- Right click on a browser tab in browser should support a context options "Insert to Canvas" - submenu should be the context tree for the current workspace
- In the popup, same as above, right click on tab entry should also support "Insert to" with a context tree for the current workspace

Optional sync settings
- "Sync only tabs for the current browser [toggle]" -> you add client/app/browser-identity-string to the featureArray when fetching tabs
- "Sync only tabs with tag: [tag]" -> you add custom/tag/<tag> to both, when storing and



# Server


## SynapsD

- 

- Add backup policy, backup DB every day at 2AM server time, keep 7 days of backups(default, configurable for each workspace, config in workspace.json at each workspace path, should work on an active workspace only)

- Add backup/restore functionality internally (full db backup/restore, we'll implement snapshoting for undo/redo ops later)

- Update mergeUp/Down + subtractUp/Down methods to use layerName, contextPath  instead of contextPath only

- Add support for layer type Label -> label type does not have a bitmap and should be removed form contextSpec as its not counted
- Ensure locked layers can not be moved/removed/deleted/renamed



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

We need to update our CLI dotfile manager (dot.js) as follows:
- Currently, when a dotfile is added from a computer, its copied to the locally cloned dotfile dot repo, comited and pushed, additionally a new document is created and stored the DB

This is the authoritative Source → lives in the canvas-server DB with files stored/available in the cloned git repo (~/.canvas/data/.../dotfiles/). This defines what dotfiles exist and their metadata. It’s declarative.

Runtime State (per-host index) → lives in ~/.canvas/db/dotfiles.json. This defines what’s currently active on this host. It’s imperative.

Both, DB document and index should contain the normalized localPath($HOME/.bashrc for example) and repo-local path(common/shell/bashrc), type (file or folder) and encryption - (bool), maybe algo but we use simple aes here. 



The per-host index should track only activation state

Suggested Flow

dot activate universe
Pull dotfiles from workspace DB/repo.
Walk them one-by-one, prompt y/n, update the per-host index.
Apply symlinks/config changes accordingly.

context set universe://customera/foo/bar --update-dotfiles
Look up dotfiles in that context.
For any conflicts (same localPath), deactivate the current one (update per-host index), activate the contextual one.

When evaluating dotfiles to apply:
Start with workspace dotfiles (from DB/repo).
Apply per-host active state (from ~/.canvas/db/dotfiles.json).
Apply context overrides (runtime decision, not persisted globally).

---



DB
 - dotfile
 - 

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

