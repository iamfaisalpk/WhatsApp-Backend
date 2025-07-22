import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import User from "./Models/User.js";
import Message from "./Models/Message.js";
import Conversation from "./Models/Conversation.js";
import dotenv from "dotenv";
dotenv.config();

export const userSocketMap = new Map();

export function setupSocket(server, app) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const onlineUsers = new Map();
  const typingUsers = new Map();

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error(" No token provided"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      return next();
    } catch (err) {
      console.error(" Socket JWT error:", err.message);
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log(` Socket connected: ${socket.id} (User: ${userId})`);
    onlineUsers.set(userId, socket.id);


    User.findByIdAndUpdate(userId, { isOnline: true }).catch((err) =>
      console.error(" user-online error:", err.message)
    );

    socket.broadcast.emit("user-status", { userId, isOnline: true });

    socket.on("description-updated", async ({ chatId, description }) => {
      try {
        io.to(chatId).emit("group-description-updated", {
          chatId,
          description,
          updatedAt: new Date(),
        });

        console.log(
          `Group description updated in real-time for chat ${chatId}`
        );
      } catch (err) {
        console.error("Group description real-time update error:", err.message);
      }
    });

    socket.on("join chat", async (conversationId) => {
      if (conversationId) {
        socket.join(conversationId);
        console.log(`User ${userId} joined room: ${conversationId}`);

        try {
          //  Update all messages in that chat where this user hasn't received yet
          const undeliveredMessages = await Message.find({
            conversationId,
            sender: { $ne: userId },
            deliveredTo: { $ne: userId },
          });

          const deliveredIds = undeliveredMessages.map((msg) => msg._id);

          if (deliveredIds.length > 0) {
            //  Update all those messages
            await Message.updateMany(
              { _id: { $in: deliveredIds } },
              { $addToSet: { deliveredTo: userId } }
            );

            //  Emit delivery to all in the conversation (especially to sender)
            io.to(conversationId).emit("delivery-update", {
              messageIds: deliveredIds.map((id) => id.toString()),
              deliveredTo: userId,
            });

            console.log(
              ` Delivery update emitted for ${deliveredIds.length} messages in ${conversationId} to ${userId}`
            );
          }
        } catch (err) {
          console.error(" Delivery update error:", err.message);
        }
      }
    });

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

        const populatedMsg = await Message.findById(newMessage._id)
          .populate("sender", "name profilePic")
          .populate({
            path: "replyTo",
            populate: {
              path: "sender",
              select: "name profilePic _id",
            },
          })
          .populate("reactions.user", "name profilePic");

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

        io.to(conversationId).emit("message received", {
          ...populatedMsg.toObject(),
          tempId,
        });

        const updatedConversation = await Conversation.findById(conversationId)
          .populate("participants", "name profilePic phone")
          .populate("lastMessage.sender", "name profilePic");

        updatedConversation.participants.forEach((participant) => {
          const socketId = onlineUsers.get(participant._id.toString());
          if (socketId) {
            io.to(socketId).emit("chat updated", updatedConversation);
          }
        });

        //  Get all active users in the conversation
        const conversation = await Conversation.findById(
          conversationId
        ).populate("participants", "_id");
        const otherUserIds = conversation.participants
          .map((u) => u._id.toString())
          .filter((id) => id !== userId);

        // Update `deliveredTo` for those who are online
        const deliveredTo = otherUserIds.filter((uid) => onlineUsers.has(uid));
        if (deliveredTo.length > 0) {
          await Message.findByIdAndUpdate(populatedMsg._id, {
            $addToSet: { deliveredTo: { $each: deliveredTo } },
          });

          io.to(conversationId).emit("delivery-update", {
            messageIds: [populatedMsg._id.toString()],
            deliveredTo,
          });
        }

        console.log(` Message delivered & sent in ${conversationId}`);
      } catch (err) {
        console.error(" Message send error:", err.message);
      }
    });

    socket.on("typing", ({ conversationId }) => {
      if (!typingUsers.has(conversationId)) {
        typingUsers.set(conversationId, new Set());
      }
      typingUsers.get(conversationId).add(userId);

      socket.to(conversationId).emit("user-typing", {
        userId,
        conversationId,
      });
    });

    socket.on("stop-typing", ({ conversationId }) => {
      const set = typingUsers.get(conversationId);
      if (set) {
        set.delete(userId);
        if (set.size === 0) typingUsers.delete(conversationId);
      }

      socket.to(conversationId).emit("user-stop-typing", {
        userId,
        conversationId,
      });
    });

    socket.on("who-is-typing", ({ conversationId }) => {
      const set = typingUsers.get(conversationId);
      if (!set) return;

      for (const typingUserId of set) {
        if (typingUserId !== userId) {
          socket.emit("user-typing", { userId: typingUserId, conversationId });
        }
      }
    });

    // Fixed message-seen handler in your socket server
    socket.on("message-seen", async ({ conversationId }) => {
      try {
        // Find all unseen messages from other users
        const unseenMessages = await Message.find({
          conversationId,
          sender: { $ne: userId },
          $or: [
            { seenBy: { $exists: false } },
            { seenBy: { $not: { $elemMatch: { $eq: userId } } } },
          ],
          $or: [
            { deletedFor: { $exists: false } },
            { deletedFor: { $not: { $elemMatch: { $eq: userId } } } },
          ],
        }).select("_id sender");

        if (unseenMessages.length === 0) {
          console.log("No unseen messages to mark as seen");
          return;
        }

        const messageIds = unseenMessages.map((msg) => msg._id);

        // Update all unseen messages
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $addToSet: { seenBy: userId } }
        );

        // Get user info for the seen update
        const user = await User.findById(userId).select("name profilePic");

        io.to(conversationId).emit("seen-update", {
          conversationId,
          seenBy: {
            _id: userId,
            name: user.name,
            profilePic: user.profilePic,
          },
          messageIds: messageIds.map((id) => id.toString()),
        });

        console.log(
          `Seen update emitted to all users in ${conversationId} for ${messageIds.length} messages by user ${userId}`
        );
      } catch (err) {
        console.error(" Seen update failed:", err.message);
      }
    });

    socket.on(
      "react-message",
      async ({ messageId, emoji, userId: reactUserId }) => {
        try {
          const message = await Message.findById(messageId);
          if (!message) {
            console.log(" Message not found for reaction:", messageId);
            return;
          }

          const existingReactionIndex = message.reactions.findIndex(
            (r) => r.user.toString() === reactUserId && r.emoji === emoji
          );

          let action;
          if (existingReactionIndex > -1) {
            message.reactions.splice(existingReactionIndex, 1);
            action = "remove";
            console.log(
              ` Removed reaction ${emoji} from message ${messageId} by user ${reactUserId}`
            );
          } else {
            // Add new reaction
            message.reactions.push({
              emoji,
              user: reactUserId,
              createdAt: new Date(),
            });
            action = "add";
            console.log(
              ` Added reaction ${emoji} to message ${messageId} by user ${reactUserId}`
            );
          }

          await message.save();

          // Get user info for the reaction update
          const user = await User.findById(reactUserId).select(
            "name profilePic"
          );

          io.to(message.conversationId).emit("react-message", {
            messageId,
            emoji,
            userId: reactUserId,
            user: {
              _id: reactUserId,
              name: user?.name,
              profilePic: user?.profilePic,
            },
            action,
            timestamp: new Date(),
          });
        } catch (err) {
          console.error(" Reaction error:", err.message);
        }
      }
    );

    socket.on(
      "delete-message",
      async ({ messageId, conversationId, deleteForEveryone }) => {
        try {
          const message = await Message.findById(messageId);
          if (!message) {
            console.log(" Message not found:", messageId);
            return;
          }

          if (deleteForEveryone && message.sender.toString() !== userId) {
            console.log(" Unauthorized delete for everyone attempt");
            return;
          }

          if (deleteForEveryone) {
            message.text = null;
            message.media = null;
            message.voiceNote = null;
            message.deletedForEveryone = true;
            message.deletedAt = new Date();
            await message.save();

            io.to(conversationId).emit("message-deleted", {
              messageId,
              deleteForEveryone: true,
              conversationId,
            });

            console.log(
              ` Message ${messageId} deleted for everyone in ${conversationId}`
            );
          } else {
            if (!message.deletedFor.includes(userId)) {
              message.deletedFor.push(userId);
              await message.save();
            }

            socket.emit("message-deleted", {
              messageId,
              deleteForEveryone: false,
              conversationId,
            });

            console.log(
              ` Message ${messageId} deleted for user ${userId} only`
            );
          }
        } catch (err) {
          console.error(" Delete message error:", err.message);
          socket.emit("error", { message: "Failed to delete message" });
        }
      }
    );

    //  Disconnect
    socket.on("disconnect", async () => {
      console.log(` Socket disconnected: ${socket.id}`);
      onlineUsers.delete(userId);

      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });

        console.log(` User ${userId} marked offline`);
        socket.broadcast.emit("user-status", { userId, isOnline: false });
      } catch (err) {
        console.error(" Disconnect update error:", err.message);
      }
    });
  });

  app.locals.io = io;
}
