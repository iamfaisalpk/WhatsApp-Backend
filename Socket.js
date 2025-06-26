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
    console.log(`🟢 Socket connected: ${socket.id}`);

    socket.on("user-online", async (userId) => {
      if (!userId) return;
      onlineUsers.set(userId, socket.id);
      try {
        await User.findByIdAndUpdate(userId, { isOnline: true });
        console.log(`✅ User ${userId} marked online`);
      } catch (error) {
        console.error("❌ user-online error:", error.message);
      }
    });

    socket.on("join-chat", (conversationId) => {
      if (conversationId) {
        socket.join(conversationId);
        console.log(`➕ Socket ${socket.id} joined: ${conversationId}`);
      }
    });

    // ✅ Updated new-message handler with tempId support
    socket.on("new-message", async (messageData) => {
      const { conversationId, senderId, text, media, tempId, voiceNote, replyTo } = messageData;

      try {
        const newMessage = await Message.create({
          conversationId,
          sender: senderId,
          text,
          media,
          voiceNote,
          replyTo,
        });

        const populatedMsg = await newMessage.populate("sender", "name profilePic");

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: {
            text: populatedMsg.text || populatedMsg.voiceNote?.url
              ? "🎤 Voice"
              : "📎 Media",
            sender: populatedMsg.sender,
            timestamp: populatedMsg.createdAt,
          },
        });

        // ✅ Emit tempId with the message to match optimistic message
        io.to(conversationId).emit("message-received", {
          ...populatedMsg.toObject(),
          tempId,
        });

        console.log(`📨 New message in ${conversationId}`);
      } catch (error) {
        console.error("❌ new-message error:", error.message);
      }
    });

    // ✅ Typing indicators
    socket.on("typing", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("typing", userId);
    });

    socket.on("stop-typing", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("stop-typing", userId);
    });

    // ✅ Seen update
    socket.on("message-seen", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("seen-update", {
        conversationId,
        seenBy: userId,
      });
      console.log(`👁️ Seen update from ${userId} in ${conversationId}`);
    });

    // ✅ Delete message
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
        console.log(`🗑️ Message ${messageId} deleted in ${conversationId}`);
      } catch (err) {
        console.error("❌ delete-message error:", err.message);
      }
    });

    // ✅ Disconnect
    socket.on("disconnect", async () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);

      const userId = [...onlineUsers.entries()].find(([, sid]) => sid === socket.id)?.[0];

      if (userId) {
        onlineUsers.delete(userId);
        try {
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });
          console.log(`⚪ User ${userId} marked offline`);
        } catch (err) {
          console.error("❌ disconnect error:", err.message);
        }
      }
    });
  });

  // Make io globally accessible (optional)
  app.locals.io = io;
}
