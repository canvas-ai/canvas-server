# To share content
/users/:user_id/workspaces
/users/:user_id/workspaces/:workspace_id
/users/:user_id/canvases
/users/:user_id/contexts

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

# Example non-related to the current api
$ curl -s https://fqdn/api/v1/hosts
$ curl -s https://fqdn/api/v1/hosts/server.domain.tld
$ curl -s https://fqdn/api/v1/hosts/server.domain.tld/packages
$ curl -s https://fqdn/api/v1/packages/yelp-xsl
$ curl -s https://fqdn/api/v1/packages/yelp-xsl/
$ curl -s https://fqdn/api/v1/packages/yelp-xsl/3.36.0-1
