# StoreD

Naive implementation of a simple CRUD data storage/retrieval middleware that aims to abstract different storage backends under a simple API.

## Architecture

- Caching layer: `cacache`
- Backend drivers:
  - `fs`
  - `file`
  - `s3`
  - `lmdb`
  - `..at some point we'll probably throw in a rclone wrapper`
- nodejs streams(yey)
- Versioning is supported at the index level, all attempts at implementing versioning in this module were dropped

## Use-case in combination with indexD

Retrieving **piano-rec-02.mp3** with checksums [sha1-.., sha256-..] located on s3://foo, smb://bar and a device-id baz at path /home/rec02.mp3, while connected to network "home", with available data backends for this location s3("s3") and smb("nas@home"), backend priority ['smb', 's3'], local cache miss -> retrieving from backend smb:// ..

## Config

Configuration paths:  
`$ CANVAS_USER_CONFIG/stored.json`  
`$ CANVAS_USER_WORKSPACES/<workspace-id>/config/stored.json`  
`$ CANVAS_USER_CONFIG/stored.backends.json`  
`$ CANVAS_USER_CONFIG/stored.cache.json`

Example configuration:

```json
{
    "cache": {
        "enabled": "true",
        "rootPath": "CANVAS_USER_CACHE"
    },
    "backends": {
        "fs": {
            "type": "local",
            "enabled": true,
            "backend": "fs",
            "backendConfig": {},
            "storeMetaData": false,
            "localCacheEnabled": false,
            "permissions": "rw",
            "dataAbstractions": []
        },
        "file": {
            "type": "local",
            "enabled": true,
            "backend": "fs",
            "backendConfig": {
                "rootPath": "CANVAS_USER_DATA",
                "storeMetaData": true
            },
            "localCacheEnabled": false,
            "permissions": "rw",
            "dataAbstractions": []
        },
        "lmdb": {
            "type": "local",
            "enabled": true,
            "backend": "lmdb",
            "backendConfig": {
                "rootPath": "CANVAS_USER_DB",
                "storeMetaData": false
            },
            "localCacheEnabled": false,
            "permissions": "rw",
            "dataAbstractions": ["tab", "note", "todo"]
        },
        "s3@home": {
            "type": "remote",
            "enabled": true,
            "backend": "s3",
            "backendConfig": {
            },
            "ignoreBackendErrors": false,
            "repeatOnError": true,
            "repeatIntervalSeconds": 10,
            "localCacheEnabled": true,
            "dataAbstractions": []
        },
        "s3@getcanvas.org": {
            "type": "remote",
            "enabled": true,
            "backend": "s3",
            "backendConfig": {
            },
            "ignoreBackendErrors": false,
            "repeatOnError": true,
            "repeatIntervalSeconds": 10,
            "localCacheEnabled": true,
            "dataAbstractions": []
        }
    }
}
```

### Common StoreD paths

- `stored://<backend-id|device-id:local-backend>/<resource-path>`
- `stored://<backend-id|device-id:local-backend>/<hash-algo>/<resource-hash>`
- `stored://<backend-id|device-id:local-backend>/<data-abstraction>/<resource-path>`
- `stored://<backend-id|device-id:local-backend>/<data-abstraction>/<hash-algo>/<resource-hash>`

- `backend-id`: presumably a human-readable string identifier of the data backend (nas@office, pub, s3@acme, workpc); "`local`" and "`canvas`" are reserved for the local canvas-server instance
- `device-id`: A unique UUID12 of a canvas-server host
- backend: optional backend ID, if no backend is specified in the stored url, we'll default to fs

#### Example paths

- `stored://nas@office/pub/foo/bar/baz.exe`
- `stored://98e0-56ac-c9c5:fs/home/foouser/Documents/ayn_rand.pdf`
- `stored://50d1-6f33-83ed:fs/d/Documents/Work/report_202402.xls`
- `stored://kvdb-backend/sha1/a76c8946ee71bac59af16a7fbe0a047e9d7f25c2`
- `stored://a2ea-14ee-53dd:lmdb/id/10021221`
- `stored://a2ea-14ee-53dd:lmdb/sha1/54dfcab1ee93b52a67a7a2b5eb32881f5758b8f3`
- `stored://a2ea-14ee-53dd:file/notes/20241217.a76c8946ee71.json`
- `stored://a2ea-14ee-53dd:fs/home/user/.canvas/data/notes/20241217.a76c8946ee71.json`

The following 2 paths are equivalent pointing to the same file located on device with ID `a2ea-14ee-53dd` using two different drivers:

- `stored://a2ea-14ee-53dd:file/notes/20241217.a76c8946ee71.json`
- `stored://a2ea-14ee-53dd:fs/home/user/.canvas/data/notes/20241217.a76c8946ee71.json`

## API

- putDocument(doc, meta, backendArray = [], options = { format, formatOptions, encoding ..})
- putBinary(data, meta, backendArray = [], options = { })
- putResource(filePathOrUrl, meta, backendArray = [], options = { operation: copy|move })
- putStream(meta, backend, options = { }) // Returns a writeable stream

### meta

Mandatory metadata object

### backendArray

- Array order defines the order of GET and PUT operations
- Backend configuration currently read from config, no option to override it at invocation(for example the number of retry operations, timeouts or whether to ignore errors for this backend)
