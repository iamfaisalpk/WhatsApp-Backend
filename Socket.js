import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken"; 
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

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("❌ No token provided"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id; 
      return next();
    } catch (err) {
      console.error("❌ Socket JWT error:", err.message);
      return next(new Error("Unauthorized"));
    }
  });

  // ✅ ON CONNECT
  io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log(`🟢 Socket connected: ${socket.id} (User: ${userId})`);
    onlineUsers.set(userId, socket.id);

    // ✅ Mark user online
    User.findByIdAndUpdate(userId, { isOnline: true }).catch((err) =>
      console.error("⚠️ user-online error:", err.message)
    );

    // ✅ Join chat room
    socket.on("join-chat", (conversationId) => {
      if (conversationId) {
        socket.join(conversationId);
        console.log(`➕ User ${userId} joined: ${conversationId}`);
      }
    });

    // ✅ Send message
    socket.on("new-message", async (data) => {
      const { conversationId, text, media, voiceNote, replyTo, tempId } = data;
      try {
        const newMessage = await Message.create({
          conversationId,
          sender: userId,
          text,
          media,
          voiceNote,
          replyTo,
        });

        const populatedMsg = await newMessage.populate("sender", "name profilePic");

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: {
            text:
              populatedMsg.text ||
              (populatedMsg.voiceNote?.url
                ? "🎤 Voice"
                : populatedMsg.media
                ? "📎 Media"
                : ""),
            sender: populatedMsg.sender,
            timestamp: populatedMsg.createdAt,
          },
        });

        io.to(conversationId).emit("message-received", {
          ...populatedMsg.toObject(),
          tempId,
        });

        console.log(`📨 New message in ${conversationId}`);
      } catch (err) {
        console.error("❌ Message error:", err.message);
      }
    });

    // ✅ Typing indicator
    socket.on("typing", ({ conversationId }) => {
      socket.to(conversationId).emit("typing", userId);
    });

    socket.on("stop-typing", ({ conversationId }) => {
      socket.to(conversationId).emit("stop-typing", userId);
    });

    // ✅ Seen
    socket.on("message-seen", ({ conversationId }) => {
      socket.to(conversationId).emit("seen-update", {
        conversationId,
        seenBy: userId,
      });
    });

    // ✅ Delete
    socket.on("delete-message", async ({ messageId, conversationId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        message.text = null;
        message.media = null;
        message.voiceNote = null;
        message.deletedForEveryone = true;
        await message.save();

        io.to(conversationId).emit("message-deleted", { messageId });
      } catch (err) {
        console.error("delete-message error:", err.message);
      }
    });

    // ✅ Disconnect
    socket.on("disconnect", async () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      onlineUsers.delete(userId);
      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });
        console.log(`⚪️ User ${userId} marked offline`);
      } catch (err) {
        console.error("disconnect error:", err.message);
      }
    });
  });

  // Optionally expose socket instance
  app.locals.io = io;
}
