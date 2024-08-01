


/*

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
