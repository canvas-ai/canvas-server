


/*

index
    .list()
    .has()
    .get()
    .set()
    .delete()
    .clear()
    .entries()
    .size()
    .create()
    .destroy()
    .db


index.tree
index.layers

index.sessions

index.devices
index.apps
index.roles
index.identities

? index.users

db.documents

---
bitmaps
    context
        global
        user
    features
        data/
        app/
        custom/
    filters
        date
        time
        name

hashmaps
    sha1
        hash | id
    sha256
        hash | id
    xxhash
        hash | id

vectors
    id | vector
metadata
    id | meta

    SynapseDB

Bitmap indexes
 - Context
    - Global/System
        - DeviceID (uuid12 of the current device)
        - Network (172.16.2.0/24)
        - Current os.user
    - User
        - Global context tree

 - Features
    - builtin (set intrinsically/gathered by the ftExtract() function)
        - data/abstraction/{tab,note,file,email..}
        - mime/type/application-json
    - builtin/nested
        - data/abstraction/email/from/contactID
        - data/abstraction/file/ext/json
    - custom
        - custom/tag/<tag>
        - custom/app/<appid>
    - custom/nested
        - custom/user/userid
        - custom/device/deviceid

 - Filters
    - date/20240101
    -


canvas.paths() // Return the current canvas paths for user and server
canvas.paths('user') // Return the current canvas paths for user
canvas.paths('server') // Return the current canvas paths for server
canvas.version() // Return the current canvas version
...

// Controlls
canvas.start()
canvas.stop()
canvas.restart()
canvas.status()

// Events
canvas.on('running', () => {})
canvas.on('error', (err) => {})
...

// Ordered by priority
canvas.services.list()
canvas.roles.list()
canvas.apps.list()

canvas.devices.list()
canvas.devices.get(id) // if null, returns the current device

canvas.users.list()
canvas.users.get(id) // if null, returns the current user

canvas.sessions.list()
canvas.sessions.get(id)
canvas.sessions.create()


canvas.contexts.list()



canvas.contexts.list()
canvas.contexts.get(id) // returns a context object

canvas.context(id).apps.list()
canvas.context(id).roles.list()





canvas.store.backends.list()


canvas.getDocument(id, format = 'json')
canvas.putDocument(id, data, backends)

canvas.context.

canvas.index.get()
canvas.index.has()

canvas.store.getDocument(id, format = 'json')
canvas.store.putDocument(id, data)
canvas.store.has(hash)
canvas.store.put(hash, data, backends)


*/




class NoFreakingIdeaInterface {

    constructor() { }


    getDocument(id, format = 'json') { }




}
