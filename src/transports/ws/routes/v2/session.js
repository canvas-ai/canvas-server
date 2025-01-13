// routes/v2/session.js

const ROUTES = {
    SESSION_LIST: 'session:list',
    SESSION_GET: 'session:get',
    SESSION_CREATE: 'session:create',
    SESSION_OPEN: 'session:open',
    SESSION_CONTEXT_GET: 'session:context:get',
    SESSION_CONTEXT_CREATE: 'session:context:create'
};

export default function(socket, deps) {
    const { ResponseObject, sessionManager } = deps;

    socket.on(ROUTES.SESSION_LIST, async (data, callback) => {
        try {
            const sessions = await sessionManager.listSessions();
            callback(new ResponseObject().success(sessions).getResponse());
        } catch (error) {
            callback(new ResponseObject().error(error.message).getResponse());
        }
    });

    socket.on(ROUTES.SESSION_GET, async (sessionId, callback) => {
        try {
            socket.session = await sessionManager.getSession(sessionId);
            callback(new ResponseObject().success(socket.session.id).getResponse());
        } catch (error) {
            callback(new ResponseObject().error(error.message).getResponse());
        }
    });

    socket.on(ROUTES.SESSION_CREATE, async (sessionId, sessionOptions, callback) => {
        try {
            socket.session = await sessionManager.createSession(sessionId, sessionOptions);
            socket.context = socket.session.getContext();
            callback(new ResponseObject().success(socket.session.id).getResponse());
        } catch (error) {
            callback(new ResponseObject().error(error.message).getResponse());
        }
    });

}
