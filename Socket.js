import { Server as SocketIOServer } from "socket.io";
import User from "./Models/User.js";
import Message from "./Models/Message.js";
import Conversation from "./Models/Conversation.js";

export function setupSocket(server, app) {
const io = new SocketIOServer(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

    const onlineUsers = new Map();

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("user-online", async (userId) => {
    if (!userId) return;
        onlineUsers.set(userId, socket.id);
    try {
        await User.findByIdAndUpdate(userId, {
            isOnline: true,
        });
        console.log(`User ${userId} marked online`);
    } catch (error) {
        console.error("user-online error:", error.message);
    }
    });

    socket.on("join-chat", (conversationId) => {
    if (conversationId) {
        socket.join(conversationId);
        console.log(`Socket ${socket.id} joined conversation: ${conversationId}`);
    }
    });

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
            text: newMessage.text,
            sender: newMessage.sender,
            timestamp: newMessage.createdAt,
        },
        });


        io.to(conversationId).emit("message-received", newMessage);
        console.log(`New message in ${conversationId}`);
    } catch (error) {
        console.error("Error sending message:", error.message);
    }
    });

    socket.on("typing", ({ conversationId, userId }) => {
        socket.to(conversationId).emit("typing", userId);
    });

    socket.on("stop-typing", ({ conversationId, userId }) => {
        socket.to(conversationId).emit("stop-typing", userId);
    });

    socket.on("disconnect", async () => {
        console.log(`Socket disconnected: ${socket.id}`);

        const userId = [...onlineUsers.entries()].find(([, sid]) => sid === socket.id)?.[0];

    if (userId) {
        onlineUsers.delete(userId);
        try {
            await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
            });
            console.log(`🔕 User ${userId} marked offline`);
        } catch (err) {
            console.error("Disconnect update error:", err.message);
        }
    }
    });
});

    app.locals.io = io;
}
