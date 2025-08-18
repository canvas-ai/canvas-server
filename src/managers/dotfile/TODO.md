https://chatgpt.com/c/6886b6b2-a264-832f-8906-2bf6d7741bec

@dot.gitignore @hooks/ 
Please implement the following
- Create a universal .gitignore file that should be used for our dotfile manager / users per-workspace dotfile repo that would containe the most common files we do not want to store in git like logs, sockets/sock, temporary or cache files etc

- Create a special install-hooks.sh script that will install git hooks locally for the user after the canvas-cli application clones the dotfile repo, hooks should be simple:

After git pull
- Find all *.encrypted files → ask for password once → store temporarily (in-memory, or OS keychain if available).
- Decrypt and remove .encrypted suffix.
- If decryption fails for any file, abort early to avoid leaving partially decrypted state.

Before git push
- Read .git-encrypted index (simple newline list of relative paths).
- For each file:
  - Encrypt → rename to filename.ext.encrypted.
  - Remove unencrypted version from working tree (we are already keeping backups of dotfiles locally)
  Important: Encrypt to a temp path first → atomically replace file after success → prevents corrupt partial encryption.
  
If user Ctrl-C’s mid-process during push, you might leave decrypted files lying around → trap signals and restore .encrypted state on exit.

Skip install if hooks are already present.
Overwrite only if --force is passed.

We'll make it executable via dot install-hooks (so as to avoid manual script execution for 90% of users).



