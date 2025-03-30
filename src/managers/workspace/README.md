# Workspace Manager

## workspaced

Tiny standalone wrapper that starts a canvas workspace in a selected folder with a bare-bones REST API. Workspaces created using workspaced can be imported to a canvas-server instance.


### CLI

```
workspaced create --path /foo/bar/baz --port 8080 --auth-token random-auth-token
    open <path>
    destroy <pathOrID>
    start <pathOrID>
    stop <pathOrID>
    status <pathOrID>
    set <pathOrID> <name|description|owner|color|acl|token> <opts>
```

### REST API

├── /workspaces
│   ├── /:id
│   ├── /:id [POST] - Update workspace parameters
│   ├── /:id/status
│   ├── /:id/query [GET] - Natural language query for workspace information
│   ├── /:id/documents [GET] - List documents in workspace
│   ├── /:id/documents [POST] - Insert documents into workspace
│   ├── /:id/documents [PUT] - Update documents in workspace
│   ├── /:id/documents [DELETE] - Delete documents from workspace
│   ├── /:id/documents/remove [DELETE] - Remove documents from workspace
│   ├── /:id/documents/by-id/:id [GET] - Get document by ID
│   ├── /:id/documents/by-abstraction/:abstraction [GET] - Get documents by abstraction
│   ├── /:id/documents/by-hash/:hashString [GET] - Get documents by hash string
│   ├── /:id/tree [GET] - Get workspace tree
│   ├── /:id/tree/layers [GET] - Get workspace layers
│   ├── /:id/tree/layers/:layerId [GET] - Get workspace layer by ID
│   ├── /:id/tree/insert [POST] - Insert a path into the workspace tree
│   ├── /:id/tree/copy [POST] - Copy workspace layer
│   ├── /:id/tree/move [POST] - Move workspace layer
│   ├── /:id/tree/remove [POST] - Remove workspace layer
│   ├── /:id/tree/merge [POST] - Merge workspace layers
│   ├── /:id/tree/subtract [POST] - Subtract workspace layers
│   └── /:id/tree/intersect [POST] - Intersect workspace layers