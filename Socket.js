import { Server as SocketIOServer } from "socket.io";
import User from "./Models/User.js";
import Message from "./Models/Message.js";
import Conversation from "./Models/Conversation.js";

export function setupSocket(server, app) {
const io = new SocketIOServer(server, {
cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"],
    credentials: true,  
},
});

const onlineUsers = new Map();

    io.on("connection", (socket) => {
    console.log(` Socket connected: ${socket.id}`);

    // Handle user online status
    socket.on("user-online", async (userId) => {
        if (!userId) return;

        onlineUsers.set(userId, socket.id);
        try {
        await User.findByIdAndUpdate(userId, { isOnline: true });
        console.log(` User ${userId} marked online`);
    } catch (error) {
        console.error("user-online error:", error.message);
    }
    });

    //  Join specific chat room
    socket.on("join-chat", (conversationId) => {
    if (conversationId) {
        socket.join(conversationId);
        console.log(`Socket ${socket.id} joined: ${conversationId}`);
    }
    });

    // Handle new message
    socket.on("new-message", async (messageData) => {
        const { conversationId, senderId, text, media } = messageData;

        try {
        const newMessage = await Message.create({
            conversationId,
            sender: senderId,
            text,
            media,
        });

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: {
            text: newMessage.text || "📎 Media",
            sender: newMessage.sender,
            timestamp: newMessage.createdAt,
        },
        });

        io.to(conversationId).emit("message-received", newMessage);
        console.log(` New message in ${conversationId}`);
    } catch (error) {
        console.error("new-message error:", error.message);
    }
    });

    // Typing indicators
    socket.on("typing", ({ conversationId, userId }) => {
        socket.to(conversationId).emit("typing", userId);
    });

    socket.on("stop-typing", ({ conversationId, userId }) => {
        socket.to(conversationId).emit("stop-typing", userId);
    });

    // Seen message event (NEW FEATURE)
    socket.on("message-seen", ({ conversationId, userId }) => {
        socket.to(conversationId).emit("seen-update", {
        conversationId,
        seenBy: userId,
        });
        console.log(` Seen update from ${userId} in ${conversationId}`);
    });

    //  Handle disconnect
    socket.on("disconnect", async () => {
        console.log(`Socket disconnected: ${socket.id}`);

    const userId = [...onlineUsers.entries()].find(
        ([, sid]) => sid === socket.id
    )?.[0];

    if (userId) {
        onlineUsers.delete(userId);
        try {
            await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
        });
            console.log(` User ${userId} marked offline`);
        } catch (err) {
            console.error("disconnect error:", err.message);
        }
    }
    });
});

    // Save io instance globally
        app.locals.io = io;
}
