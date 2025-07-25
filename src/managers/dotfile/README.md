# Dotfile manager

## CLI

[user_or_team]@[canvas-host]/[workspace_id]/[resource...]

```bash
# Bind to local or remote context
$ context switch user_or_team@canvas-host/context_id
```


```bash
$ canvas dotfile list | canvas dotfiles | dot list
# Returns:
# user_email/workspace_name/dotfile
# user_email/work/ssh
# user_email/work/vscode
# user_email/work/shell
# team-workspace/shell
# user_email/home/shell
# user_email/home/audio/audacious
# user_email/home/email/evolution
  
$ ws workspace-name dotfile list | ws workspace-name dotfiles
# Returns for workspace workspace-name
# ssh
# vscode
# shell
# shell/bash

$ ws workspace-name dotfile activate # activates all dotfiles within the current active workspace
$ ws workspace-name dotfile activate ssh # activates the ssh dotfile only
$ ws workspace-name dotfile deactivate ssh
$ ws workspace-name dotfile update optional-dotfile # update / git fetch updates for all dotfiles of the given workspace
$ ws workspace-name dotfile status optional-dotfile

$ canvas dotfile status user_email/workspace_name/dotfile


$ context dotfiles # Dotfiles of the workspace of the current context
$ context dotfile activate ssh # Lets say context url is home://travel/bratislava, workspace is "home", dotfile activate ssh would activate dotfiles from the home workspace
# This functionality is meant just as a shortcut for now, no dynamic dotfile update kung-fu


# dot command 
$ dot list
$ dot activate user@host:work/ssh
$ 
