import Message from "../Models/Message.js";
import Conversation from "../Models/Conversation.js";
import { uploadToCloudinary } from "../Utils/uploadToCloudinary.js";

export const sendMessage = async (req, res) => {
  try {
    const { conversationId, text, duration, replyTo, tempId } = req.body;
    const senderId = req.user.id;

    const mediaFile = req.files?.media?.[0];
    const voiceNoteFile = req.files?.voiceNote?.[0];

    if (!conversationId || (!text && !mediaFile && !voiceNoteFile)) {
      return res.status(400).json({
        success: false,
        message: "Text, media, or voice note is required",
      });
    }

    let media = null;
    let voiceNote = null;

    // ✅ Media upload
    if (mediaFile) {
      const uploadResult = await uploadToCloudinary(mediaFile, "whatsapp-clone");
      const fileType = mediaFile.mimetype;
      media = {
        url: uploadResult.secure_url,
        type: fileType.startsWith("image")
          ? "image"
          : fileType.startsWith("video")
          ? "video"
          : fileType.startsWith("audio")
          ? "audio"
          : "file",
      };
    }

    // ✅ Voice note upload
    if (voiceNoteFile) {
      const uploadResult = await uploadToCloudinary(voiceNoteFile, "whatsapp-clone");
      voiceNote = {
        url: uploadResult.secure_url,
        duration: Number(duration) || 0,
      };
    }

    // ✅ Create and save message with tempId
    const newMessage = await Message.create({
      conversationId,
      sender: senderId,
      text: text?.trim() || null,
      media,
      voiceNote,
      replyTo: replyTo || null,
      seenBy: [senderId],
      status: "sent",
      tempId: tempId || null, // 💡 Must save tempId to match optimistic message
    });

    // ✅ Update lastMessage in conversation
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
            : "📎 Media"),
        sender: senderId,
        timestamp: newMessage.createdAt,
      },
    });

    // ✅ Populate and send back to socket
    const populatedMessage = await newMessage
      .populate("sender", "name profilePic")
      .populate("replyTo");

    const finalMessage = {
      ...populatedMessage.toObject(),
      tempId: tempId || null, // 🧠 Ensure frontend can match this
    };

    req.app.locals.io.to(conversationId).emit("message-received", finalMessage);

    return res.status(201).json({
      success: true,
      message: finalMessage,
    });

  } catch (error) {
    console.error("Send message error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};





export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId })
      .populate("sender", "name profilePic")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const markAsSeen = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;

    await Message.updateMany(
      { conversationId, seenBy: { $ne: userId } },
      { $addToSet: { seenBy: userId } }
    );

    res.status(200).json({ success: true, message: "Messages marked as seen" });
  } catch (error) {
    console.error("Mark as seen error:", error);
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

    await Message.deleteMany({ conversationId });

    req.app.locals.io.to(conversationId).emit("chat-cleared", {
      conversationId,
    });

    res
      .status(200)
      .json({ success: true, message: "Chat cleared successfully" });
  } catch (error) {
    console.error("Clear Chat Error:", error);
    res.status(500).json({ message: "Failed to clear chat" });
  }
};

//  Delete one message by ID
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this message" });
    }

    message.text = null;
    message.media = null;
    message.voiceNote = null;
    message.deletedForEveryone = true;

    await message.save();

    req.app.locals.io.to(message.conversationId.toString()).emit("message-deleted", {
      messageId: message._id,
    });

    res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("Delete message error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

