We need to reintroduce the importWorkspace(workspacePath, destroyExisting = bool) and exportWorkspace(nameOrID, destinationPath) methods in our workspace manager.

The design should be as follows(I'm open to suggestsions here):
- importWorkspace(workspacePath, ): Takes a extracted local folder path or a zip or tar file. If the path is a zip or tar/tar.gz we'd first extract it to a temporary folder (not sure where, maybe in users "home" but users "home" is actually his Universe workspace which would prevent the user from ever bee able to import(and replace)/export his universe) - once extracted or in case a path is supplied, we'd check if there is a workspace.json and fail if its not found or not correct. We'd rewrite the original owner with the current owner
ID, update rootPath, configPath and the updatedAt timestamp. store the original owner and details into metadata: {}. On success we'd initialize it the same way as we do for a new workspace

- exportWorkspace(nameOrId, dstPath, format = zip|tar|gzip) would first stop the workspace, then create a archive - again question is where to store it, "cache" folder which would be excluded from zip


Add Canvas support
  GET /contexts/:cid/canvases/foo  will create a context-bound canvas within context cid(cid.url) with ID foo
  GET /workspaces/:wid/canvases/foo will create a unbound canvas with contextPath / (or ?contextPath=/foo/bar/baz) with ID "foo"
  
  canvas IDs have to be unique 
  Every canvas will setup a websocket connection to canvas-server
  Canvas open on your tablet, another on your phone, another on your desktop and laptop can all be controllable centraly
  $ hi lucy "can you play me that podcast we started listening to yesterday evening on the tv" # canvas ID "tv"
  $ hi carmack "show me the last emails from that idiot yesterday on my laptop" # canvas ID "laptop"

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

## Sharing functionality

Sharing functionality for Workspaces and Contexts is no longer working, we will need a 2 punch process, one for the backend implementation and one for the webui. Lets start with the backend (phase #1).

The following sharing options should be updated/implemented, please do not implement any changes yet, lets fine-tune the design first:

- Token based sharing: User creates a R/RW token for a resource and shares it together with the resource URL with another user
  - a pub route currently looks like follows:
    https://canvas-server-url/rest/v2/pub/user@email.tld/workspaces/:workspace_id
    https://canvas-server-url/rest/v2/pub/user@email.tld/contexts/:context_id
    the above is meant to be user/cli friendly, but may require a design tweak
    
  - For workspaces:
    - User - regardless if he is server-local(registered on the current canvas-server remote) or remote - should be able to open a shared workspace / context or even add it via his webUI by specifying the URL and access token. He does not need to be a user on the remote hosting the workspace
    - Workspace would then be added to his index and appear as a normal workspace with type: remote
    - Workspace sharing tokens should be stored within the actual workspace.json(in the workspace root folder), hence, when a workspace is exported from canvas-server/remoteA and imported to remoteB, it will still allow access (assuming consumer/user updates its URL)
    
  - For contexts:
    - Same applies for contexts, a user should be able to generate a sharing token for his context
    
  - Q1: Should we support ad-hoc secret links under our pub endpoint with expiration? 
        
- Username based sharing: User can allow access to his contexts or workspaces based on user email. User email has to be canvas-server local for now but this is not really a requirement given the floating nature of workspaces(one can freely migrate them between a local NAS instance, AWS or some canvas SaaS provider) - with that being said, it may present a security risk so I guess we should not allow arbitrary email IDs to be added

Sharing a workspace or a context this way makes them available to the target user right away due to the way the backend is implemented. As mentioned above, this type of sharing is not portable - iow - if a workspace gets exported, email based permissions would have to be recreated (this may change in the future)


## API

- Add a workspaces/:workspace_id/db endpoint
  - /stats
  - /status
  - /dump
  - /snapshots
    - /timestamp
      - /dump
      - /restore

## Dotfile Manager

Lets go over our dotfile management solution and check if the below design is kept:

- Dotfiles are managed in git, a bare git repo is initialized in user@canvas-remote:workspace under the workspace root /dotfiles.git, preseeded with a few handy hook scripts, but adding a dotfile to the repo MUST create a JSON document in canvas-db with schema 'data/abstraction/dotfile'

- To init such a repo, we use 
  $ dot init user@remote:workspace or just $ dot init workspace # for bound remotes
  DB is the authoritative source with files stored/available in the cloned git repo (~/.canvas/data/.../dotfiles/). 
  
- To sync a repo localy, we use
  $ dot sync user@remote:workspace
  
  Sync should git clone the repo and fetch all dotfiles from the workspace, we can use the default documents route with featureArray ['data/abstraction/dotfile'] but even better, this handy endpoint (see example below with a test token)
  $ export TOKEN=canvas-8f45742561402be03bdb91f3cd167fc4dfec1e04a06402ee
  $ curl -sH  "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" https://canvas.idnc.sk/rest/v2/workspaces/universe/dotfiles  | jq .
{
  "status": "success",
  "statusCode": 200,
  "message": "Dotfiles retrieved successfully",
  "payload": [
    {
      "id": 100354,
      "schema": "data/abstraction/dotfile",
      "schemaVersion": "2.0",
      "data": {
        "localPath": "$HOME/.sampledotfile",
        "repoPath": "shell/custom/sampledot.txt",
        "type": "file",
        "priority": 0
      },
      "metadata": {
        "contentType": "application/json",
        "contentEncoding": "utf8",
        "dataPaths": [],
        "contextUUIDs": [],
        "contextPath": [],
        "features": [
          "data/abstraction/dotfile"
        ]
      },
      "indexOptions": {
        "checksumAlgorithms": [
          "sha1",
          "sha256"
        ],
        "primaryChecksumAlgorithm": "sha1",
        "checksumFields": [
          "data.localPath",
          "data.repoPath"
        ],
        "ftsSearchFields": [
          "data.localPath",
          "data.repoPath"
        ],
        "vectorEmbeddingFields": [
          "data.localPath",
          "data.repoPath"
        ],
        "embeddingOptions": {
          "embeddingModel": "text-embedding-3-small",
          "embeddingDimensions": 1536,
          "embeddingProvider": "openai",
          "embeddingProviderOptions": {},
          "chunking": {
            "type": "sentence",
            "chunkSize": 1000,
            "chunkOverlap": 200
          }
        }
      },
      "createdAt": "2025-08-28T19:12:54.854Z",
      "updatedAt": "2025-08-28T19:12:54.854Z",
      "checksumArray": [
        "sha1/6b7982e1a86be35e46c97d8b5edf84d6a2ed05c6",
        "sha256/6b3bd4aac2e219c03101021e8ead3347771966b9ed1a78f04132ec6c9cbd909d"
      ],
      "embeddingsArray": [],
      "parentId": null,
      "versions": [],
      "versionNumber": 1,
      "latestVersion": 1
    }
  ],
  "count": 1,
  "totalCount": 1
}
  
  - Runtime State (per-host index) → lives in ~/.canvas/db/dotfiles.json. Each sync should update this index(same as we do for workspaces, contexts, agents etc), always unless canvas-server is not available
  One question to solve for sync, should we decrypt all files marked as encrypted(we have a git hook for that) - asking the user for a decryption password during the process and store the result in the local index too(preventing activatetion if we failed to decrypt a dotfile)
  
- To activate a dotfile, user runs 
  $ dot activate workspace/dotfile or $ canvas context set /foo/bar/baz --activate-dotfiles (which will process only dotfiles relevant to the context, replacing existing symlinks with the ones supplied by the context)
  On success, we need to update the local index

- To add a dotfile
  $ dot add ~/.bashrc user@remote:universe/shell/bashrc --encrypt (optional) --context foo/bar/baz(optional) --priority 123 (we should support a optional positive number here)
  This should
    - Copy the file into the local repo
    - Create a document in canvas (this is critical hence we should revert the op above on error)
    - Commit + push the changes
    - Update our local index (we index all dotfiles regardless of the context
    
Please review the current codebase and propose updates/changes both in code or in design in general
A proper local index structure has to be devised to accomodate the above use-codebase
As a use-case example, a shorthand command
$ ctx set /work/mb --update-dotfiles 
should link my ~/.ssh dotfiles from universe/mb/ssh
$ ctx set /work/wipro --update-dotfiles
should override them and replace the ~/.ssh symlink from universe/wipro/ssh
$ ctx set /work or / with --update-dotfiles
would take the dotfile with the highest priority, in my case from universe/common/ssh, otherwise would print the candidates and tell the user to explicitly apply one from the list


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
