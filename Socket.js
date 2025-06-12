import { Server as SocketIOServer } from "socket.io";
import User from "./Models/User.js";

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

    // User joins after login
    socket.on("user-online", async (userId) => {
        try {
        await User.findByIdAndUpdate(userId, {
            isOnline: true,
        });
        console.log(`User ${userId} is online`);
    } catch (error) {
        console.error("user-online error:", error);
    }
    });

    // Join specific chat room or session
    socket.on("joinSession", (sessionId) => {
        console.log(`Socket ${socket.id} joining session: ${sessionId}`);
        socket.join(sessionId);
        sessionSockets.set(sessionId, socket.id);
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
        console.log(`Socket disconnected: ${socket.id}`);
        for (const [sessionId, sockId] of sessionSockets.entries()) {
        if (sockId === socket.id) {
            sessionSockets.delete(sessionId);
            break;
        }
        }

        // Set user offline if tracked (optional enhancement)
    try {
        const user = await User.findOneAndUpdate(
            { isOnline: true },
            { isOnline: false, lastSeen: new Date() },
            { new: true }
        );
        if (user) console.log(`User ${user._id} went offline`);
    } catch (err) {
        console.error("Disconnect update error:", err);
    }
    });
});

    // Attach io to app.locals
    app.locals.io = io;
}
