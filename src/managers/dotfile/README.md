# Dotfile manager

## CLI

Addressing scheme
[user_or_team]@[canvas-host]/[workspace_id]/[resource-path]

### dot command/subcommand interface

Dotfiles are synced to ~/.canvas/dotfiles/<workspace_id>/<resource> using nodejs git and users workspace access tokens, server-side they are stored in the workspace dir under a "dotfiles" folder and exportable/importable. 

$ dot list
$ dot init <user@remote/workspace or workspace/path>
$ dot activate <workspace or workspace/dotfile>
$ dot deactivate <workspace or workspace/dotfile>
$ dot push <workspace or workspace/dotfile>
$ dot pull <workspace or workspace/dotfile>
$ dot status <workspace or workspace/dotfile>

```bash
$ canvas dotfiles | canvas dot list | canvas dot
# Returns:
# user@remote/path, for example
# user@canvas.local/workspace_name/dotfile
# user@canvas.work/customer-a/ssh

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
