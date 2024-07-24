# StoreD

Naive implementation of a checksum-based CRUD data storage/retrieval middleware that aims to abstract different storage backends under a simple(and stupid) API.

## Architecture

- cacache
- backend drivers {file, s3, ..at some point we'll probably throw in a rclone wrapper}
- Support for streams

## Use-case in combination with indexD

Retrieving **piano-rec-02.mp3** with checksums [sha1-.., sha256-..] located on s3://foo, smb://bar/path and local:/deviceid/baz/path, while connected to network "home", with available data backends s3("s3") and smb("home-nas"), backend priority ['smb', 's3'], local cache miss -> retrieving from backend smb:// ..

## API

`getDocument(checksum, backendArray)`  
`getDocumentAsStream(checksum, backendArray)`
