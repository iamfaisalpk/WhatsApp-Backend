import Message from "../Models/Message.js";
import Conversation from "../Models/Conversation.js";

export const sendMessage = async (req, res) => {
  try {
    console.log(" Incoming request body:", req.body);
    console.log(" Incoming files:", req.files);

    const { conversationId, text, duration, replyTo, forwardFrom, tempId } =
      req.body;
    console.log("incoming reqbody", req.body);
    console.log("incoming files", req.files);
    const senderId = req.user.id;

    const mediaFile = req.files?.media?.[0];
    const voiceNoteFile = req.files?.voiceNote?.[0];

    if (
      !conversationId ||
      (!text && !mediaFile && !voiceNoteFile && !forwardFrom)
    ) {
      return res.status(400).json({
        success: false,
        message: "Text, media, voice note, or forwarded message is required",
      });
    }

    //  Block Check (WhatsApp behavior)
    const conversation = await Conversation.findById(conversationId).populate(
      "members"
    );

    const receiver = conversation.members.find(
      (member) => member._id.toString() !== senderId
    );

    if (receiver?.blockedUsers?.includes(senderId)) {
      return res.status(403).json({
        success: false,
        message: "You are blocked by this user and cannot send messages.",
      });
    }

    let media = null;
    let voiceNote = null;

    if (mediaFile) {
      const uploaded = mediaFile;
      const fileType = uploaded.mimetype;

      media = {
        url: uploaded.path,
        type: fileType.startsWith("image")
          ? "image"
          : fileType.startsWith("video")
          ? "video"
          : fileType.startsWith("audio")
          ? "audio"
          : "file",
        originalName: uploaded.originalname,
      };
    }

    if (voiceNoteFile) {
      const uploaded = voiceNoteFile;
      voiceNote = {
        url: uploaded.path,
        duration: Math.max(0, Math.floor(Number(duration) || 0)),
      };
    }

    const newMessage = await Message.create({
      conversationId,
      sender: senderId,
      text: text?.trim() || null,
      media,
      voiceNote,
      replyTo: replyTo || null,
      forwardFrom: forwardFrom ? JSON.parse(forwardFrom) : null,
      seenBy: [senderId],
      status: "sent",
      tempId: tempId || null,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        text:
          newMessage.text ||
          (media?.type === "image"
            ? "📷 Photo"
            : media?.type === "video"
            ? "🎥 Video"
            : media?.type === "file"
            ? "📎 File"
            : voiceNote
            ? "🎤 Voice Note"
            : forwardFrom
            ? "📩 Forwarded message"
            : "📎 Media"),
        sender: senderId,
        timestamp: newMessage.createdAt,
      },
      updatedAt: new Date(),
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "name profilePic")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "name profilePic _id",
        },
      })

      .populate("reactions.user", "name profilePic");

    const finalMessage = {
      ...populatedMessage.toObject(),
      tempId: tempId || null,
    };

    req.app.locals.io.to(conversationId).emit("message-received", finalMessage);

    return res.status(201).json({
      success: true,
      message: finalMessage,
    });
  } catch (error) {
    console.error(" Send message error:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const messages = await Message.find({
      conversationId,
      deletedFor: { $ne: userId },
    })
      .populate("sender", "name profilePic")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "name profilePic _id",
        },
      })

      .sort({ createdAt: 1 });

    res.status(200).json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const markAsSeen = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;

    if (!conversationId) {
      return res
        .status(400)
        .json({ success: false, message: "Conversation ID is required" });
    }

    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        seenBy: { $ne: userId },
        deletedFor: { $ne: userId },
      },
      { $addToSet: { seenBy: userId } }
    );

    // Emit realtime seen-update to other users in the conversation
    req.app.locals.io.to(conversationId).emit("seen-update", {
      conversationId,
      seenBy: userId,
    });

    res.status(200).json({ success: true, message: "Messages marked as seen" });
  } catch (error) {
    console.error(" Mark as seen error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteChat = async (req, res) => {
  const { chatId } = req.params;

  try {
    const chat = await Conversation.findById(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    await Message.deleteMany({ conversationId: chatId });
    await chat.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Chat and messages deleted" });
  } catch (error) {
    console.error("Delete Chat Error:", error);
    res.status(500).json({ message: "Failed to delete chat" });
  }
};

export const clearChatMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const messages = await Message.find({ conversationId });

    const updatePromises = messages.map((msg) => {
      if (!msg.deletedFor?.includes(userId)) {
        msg.deletedFor = [...(msg.deletedFor || []), userId];
        return msg.save();
      }
    });

    await Promise.all(updatePromises);

    req.app.locals.io.to(conversationId).emit("chat-cleared", {
      conversationId,
      userId,
    });

    res.status(200).json({ success: true, message: "Chat cleared for you" });
  } catch (error) {
    console.error("Clear Chat Error:", error);
    res.status(500).json({ message: "Failed to clear chat" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    if (message.sender.toString() !== userId) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    message.text = null;
    message.media = null;
    message.voiceNote = null;
    message.deletedForEveryone = true;

    await message.save();

    req.app.locals.io
      .to(message.conversationId.toString())
      .emit("message-deleted", {
        messageId: message._id,
        deletedForEveryone: true,
      });

    res
      .status(200)
      .json({ success: true, message: "Message deleted for everyone" });
  } catch (error) {
    console.error("Delete message error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    if (!message.deletedFor?.includes(userId)) {
      message.deletedFor = [...(message.deletedFor || []), userId];
      await message.save();
    }

    res.status(200).json({ success: true, message: "Message deleted for you" });
  } catch (error) {
    console.error("Delete for me error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ➕ React to a message
export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    // Check if user already reacted
    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.user.toString() === userId
    );

    if (existingReactionIndex !== -1) {
      // If emoji is same, remove it (toggle off), otherwise update
      if (message.reactions[existingReactionIndex].emoji === emoji) {
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        message.reactions[existingReactionIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ emoji, user: userId });
    }

    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate("sender", "name profilePic")
      .populate("reactions.user", "name profilePic");

    // Emit via socket
    req.app.locals.io
      .to(message.conversationId.toString())
      .emit("message-reacted", {
        messageId: updatedMessage._id,
        reactions: updatedMessage.reactions,
      });

    res.status(200).json({
      success: true,
      message: "Reaction updated",
      reactions: updatedMessage.reactions,
    });
  } catch (error) {
    console.error("React error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
