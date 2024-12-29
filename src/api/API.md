auth:
    - login
    - logout
    - renewToken
    - status

session:  # uuid but usually a user-chosen name like "ws" for workstation or "homenb" or "workphone"
    - create
      - selectoWorkspace || createWorkspace
        - would call workspaces.create ?
    - remove
    - update
    - list
    - select

workspace: # Defaults to universe, may be something like work or work.mb(baseUrl /work/mb), work.manes(baseUrl /work/manes), home (baseUrl /home)
    - create
    - remove
    - update
    - list
    - select

context:
    - id # Context is a high-level structure encompassing session@workspace:url
    - session # getter only ?
    - workspace # getter only ?
    - url # context url (what we currently work on, like work/mb/dev/jira-1234)
    - set (url || workspace:url || session@workspace:url)

data:
    - list (contextArray, featureArray, filterArray)
    - get (by ID)
    - get (by hash) / sha256 or md5 etc / hash
    - put  (contextArray, featureArray, optionalBackendArray)
    - remove (contextArray, featureArray, optionalBackendArray)
    - delete ()

REST API:
POST /api/v2/auth

GET /api/v2/sessions # List sessions
PUT /api/v2/sessions # Create session

GET /api/v2/workspaces
GET /api/v2/workspaces/:id
POST /api/v2/workspaces/:id

GET /api/v2/contexts

GET /api/v2/data
PUT /api/v2/data

GET /api/v2/data/abstr/tabs
GET /api/v2/data/abstr/notes
GET /api/v2/data/abstr/files

