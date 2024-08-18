# IndexD

Naive implementation of a bitmap-centered context-based indexing engine.  
Main function is to:

- index all user-related events and data regardless of its source or location  
- provide relevant data to the (user, global/system) context user is working in
- Heavily optimize RAG workloads on your own data
- (At some point) Integrate into the inference engine

## Architecture

- LMDB
- Roaring bitmaps
- flexsearch for full-text-search
- LanceDB

### Data pillar

- identities
- contacts
- devices
- services
- roles
- apps
- dataSources
- eventSources

### Hashmaps

- KV in LMDB
- hash/\<algo\>/\<checksum\> | objectID
- \<algo\>/\<checksum\> | objectID (one of these will get implemented, suggestions welcome)

### Bitmap indexes

- System (reserved id range)
  - device/uuid/\<deviceUUID12\> | bitmap
  - device/type/\<device-type\> | bitmap
  - action/\<action\> | bitmap
- Context
  - Identified by layer UUID12
  - Implicit AND on all bitmaps
- Features
  - data/abstraction/{tab,note,file,email,...} | bitmap; implicit OR
  - mime/application/json | bitmap
  - (data/abstraction?)email/from/\<objectID\>
  - (data/abstraction?)email/attachment | bitmap
  - custom/<app-ident>/<tag> for example custom/browser/chrome or custom/tag/work; AND, OR
- Filters
  - date/YYYYmmdd | bitmap; AND, OR
  - name/\<bitmap-based-fts-test :)\>
- Nested
  - id/\<objectID\> | bitmap

## References

[0] Tbd
