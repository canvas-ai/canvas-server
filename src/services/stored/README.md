# StoreD

Naive implementation of a simple CRUD data storage/retrieval middleware that aims to abstract different storage backends under a simple(and stupid) API.

## Architecture

- Cahing layer: `cacache`
- Backend drivers: `file/file.json/file.yaml`, `s3`, `lmdb`, `..at some point we'll probably throw in a rclone wrapper`
- nodejs streams(yey)
- Versioning is supported on the index level, StoreD does not care and treats every version as a separate document

## Use-case in combination with indexD

Retrieving **piano-rec-02.mp3** with checksums [sha1-.., sha256-..] located on s3://foo, smb://bar/path and a local device-id at path /baz/rec02.mp3, while connected to network "home", with available data backends for this location s3("s3") and smb("nas@home"), backend priority ['smb', 's3'], local cache miss -> retrieving from backend smb:// ..

## Config

Configuration paths:  
`$ CANVAS_USER_CONFIG/stored.json`  
`$ CANVAS_USER_WORKSPACES/<workspace-id>/config/stored.json`  
`$ CANVAS_USER_CONFIG/stored.backends.json`  
`$ CANVAS_USER_CONFIG/stored.cache.json`

```json
{
    "cache": {
        "enabled": "true",
        "rootPath": "CANVAS_USER_CACHE"
    },
    "backends": {
        "local-fs": {
            "driver": "file",
            "driverConfig": {
                "rootPath": "CANVAS_USER_DATA",
                "storeMetaData": true,
                "permissions": "rw"
            },
            "ignoreBackendErrors": false,
            "repeatOnError": false,
            "dataTypes": [],
            "localCacheEnabled": false
        },
        "local-db": {
            "driver": "lmdb",
            "driverConfig": {
                "rootPath": "CANVAS_USER_DB"
            },
            "ignoreBackendErrors": false,
            "dataTypes": [],
            "localCacheEnabled": false
        },
        "s3": {
            "driver": "s3",
            "driverConfig": {},
            "ignoreBackendErrors": false,
            "dataTypes": [],
            "repeatOnError": true,
            "repeatIntervalSeconds": 10,
            "localCacheEnabled": true
        }
    }
}
```

### Generic StoreD paths

- `stored://<backendId>/<resource-path>`
- `stored://<backendId>/<hash-algo>/<resource-hash>`
- `stored://<backendId>/<data-abstraction>/<hash-algo>/<resource-hash>`

#### Example paths

- `stored://nas@office/pub/foo/bar/baz.txt`
- `stored://98e0-56ac-c9c5/home/foouser/Documents/bazdata.txt`
- `stored://kvdb1/sha1/a76c8946ee71bac59af16a7fbe0a047e9d7f25c2`
- `stored://134a-efdf-1143/notes/sha1/a76c8946ee71bac59af16a7fbe0a047e9d7f25c2`

## API

- putDocument(doc, backendArray = [], options = { format, formatOptions, encoding ..})
- putBinary(data, backendArray = [], options = { })
- putResource(filePathOrUrl, backendArray = [], options = { operation: copy|move })

### backendArray

- Array order defines the order of PUT operations
- Backend configuration currently read from config, no option to override it at invocation(for example the number of retry operations, timeouts or whether to ignore errors for this backend)
- Backend ID has to be either the current device ID (uuid12) or defined in data.backends || stored.backends
