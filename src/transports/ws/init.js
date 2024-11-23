import createSocketTransport from './transport-socket.js';
import { Server } from 'socket.io';

// Create socket.io server
const io = new Server(httpServer);

// Initialize the transport
const socketTransport = createSocketTransport(io, {
    sessionManager: yourSessionManager,
    session: defaultSession,
    context: defaultContext,
    ResponseObject: YourResponseObjectClass,
    db: yourDatabase
});
