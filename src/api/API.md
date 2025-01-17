auth:
    - login
    - logout
    - renewToken
    - status

sessions:        # uuid but usually a user-chosen name like "ws" for workstation or "homenb" or "workphone"
    - list      # ws@universe://foo/bar/baz | phone@work.mb://devops/jira-1234 | nb@work.manes://devops/cr1234
    - create
    - select || connectToSession
    - update
    - remove

workspaces: # Defaults to universe, may be something like work or work.mb(baseUrl /work/mb), work.manes(baseUrl /work/manes), home (baseUrl /home)
    - list
    - create
    - select || enter
    - update
    - remove

contexts:

data:
    - list (contextArray, featureArray, filterArray)
    - list / <abstr>  # list/tabs
    - get (by ID)
    - get (by hash) / sha256 or md5 etc / hash
    - get (abstr) / <abstr>
    - put  (contextArray, featureArray, optionalBackendArray)
    - remove (contextArray, featureArray, optionalBackendArray)
    - delete ()
    - backends # Descoped for MVP


layers:
    locked: bool
    workspaces: []
    merge
    subtract

features:

context:
    - id # Context is a high-level structure encompassing session@workspace:url
    - session # getter only ?
    - workspace # getter only ?
    - url # context url (what we currently work on, like work/mb/dev/jira-1234)
    - set (url || workspace:url || session@workspace:url)

identities: # Descoped for MVP
devices:    # Descoped for MVP
services:   # Descoped for MVP
apps:       # Descoped for MVP
roles:      # Descoped for MVP
agents:     # Descoped for MVP
minions:    # Descoped for MVP


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

