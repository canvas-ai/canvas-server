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

# Server

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

## Architectural changes

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
