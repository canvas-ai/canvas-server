# Dotfile manager

## Server

Lets create a simple dotfile manager canvas-server module and the accompanied REST API endpoints to enable per-workspace dotfile storage:
- We should use isomorphic-git on the server
- canvas-server should internally mount the bare git repo at workspace-path/dotfiles.git
- We should re-use existing auth mechanisms to access the repo so that a user can use his app or workspace-access api-tokens to authenticate
- We should only init the repository on-demand
- The following REST API endpoints should be implemented:
  - /workspaces/:workspaceId/dotfiles/init - to initialize a repo
  - /workspaces/:workspaceId/dotfiles/status - to check if a repo is initialized or not
  - /workspaces/:workspaceId/dotfiles/git/ for direct access using git / canvas-cli
  - /workspaces/:workspaceId/dotfiles/git/info/refs
  - /workspaces/:workspaceId/dotfiles/git/git-upload-pack
  - /workspaces/:workspaceId/dotfiles/git/git-receive-pack
  Make the HTTP handlers under /workspaces/:workspaceId/dotfiles/git/* just proxy to the bare git repo using isomorphic-git

## CLI

Default addressing scheme used for all remote resources
[user_or_team]@[remote-id]:[workspace_id]/[resource-path]

### dot command/subcommand interface

Dotfiles are synced to ~/.canvas/user.name@remote.id/<workspace.name>/dotfiles

We may have
- corpuser1@canvas.acmeorg/work/dotfiles/ssh
- corpuser2@canvas.acmeorg/work/dotfiles/ssh

Switching between these 2 dotfiles would then just require
$ canvas dot activate corpuser1@canvas.acmeorg:work/ssh
or as we are also exporting a "dot" wrapper
$ dot activate corpuser2@canvas.acmeorg:work/ssh


$ dot list
$ dot init <user@remote/workspace or workspace/path>
$ dot activate <workspace or workspace/dotfile>
$ dot deactivate <workspace or workspace/dotfile>
$ dot push <workspace or workspace/dotfile>
$ dot pull <workspace or workspace/dotfile>
$ dot status <workspace or workspace/dotfile>

```bash
$ canvas dotfiles | canvas dot list | canvas dot
Returns:
- user.name@remote.id:path, for example

$ canvas dot activate user@remote:workspace/path
$ canvas dot deactivate user@remote:workspace/path
$ canvas dot status user@remote:workspace/path

$ ws workspace-name dotfiles | ws workspace-name dot list
# Returns for workspace workspace-name
# ssh
# vscode
# shell
# shell/bash

$ ws workspace-name dot activate # activates all dotfiles from the current active workspace
$ ws workspace-name dot activate ssh # activates the ssh dot only
$ ws workspace-name dot deactivate ssh
$ ws workspace-name dot pull optional-dotfile # update / git fetch updates for all dotfiles of the given workspace
$ ws workspace-name dot status optional-dotfile
