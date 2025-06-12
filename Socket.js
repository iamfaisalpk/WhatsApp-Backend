import { Server as SocketIOServer } from "socket.io";

export function setupSocket(server, app) {

const io = new SocketIOServer(server, {
    cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    },
});

const sessionSockets = new Map();

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("joinSession", (sessionId) => {
    console.log(`Socket ${socket.id} joining session: ${sessionId}`);
    socket.join(sessionId);
    sessionSockets.set(sessionId, socket.id);
    });

    socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    for (const [sessionId, sockId] of sessionSockets.entries()) {
        if (sockId === socket.id) {
        sessionSockets.delete(sessionId);
        break;
        }
    }
    });
});

    // Attach io instance to express app locals for access in routes/controllers
app.locals.io = io;
}
