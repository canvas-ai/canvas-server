# To share content
/pub/:user_id/workspaces
/pub/:user_id/workspaces/:workspace_id
/pub/:user_id/canvases
/pub/:user_id/contexts

# Auth routes
/auth/me
/auth/login
/auth/tokens
..

# Authenticated resource routes
/workspaces
/workspaces/:workspace_id/documents
/workspaces/:workspace_id/tree
/workspaces/:workspace_id/roles
/workspaces/:workspace_id/dotfiles
/contexts
/contexts/:context_id/documents

