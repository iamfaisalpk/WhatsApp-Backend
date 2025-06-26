import Message from "../Models/Message.js";
import Conversation from "../Models/Conversation.js";
import { uploadToCloudinary } from "../Utils/uploadToCloudinary.js";


export const sendMessage = async (req, res) => {
  try {
    const { conversationId, text, duration } = req.body;
    const senderId = req.user.id;

    const mediaFile = req.files?.media?.[0];
    const voiceNoteFile = req.files?.voiceNote?.[0];

    console.log("📥 Incoming body:", req.body);
    console.log("📎 Incoming files:", req.files);

    if (!conversationId || (!text && !mediaFile && !voiceNoteFile)) {
      return res.status(400).json({
        success: false,
        message: "Text, media, or voice note is required",
      });
    }

    let media = null;
    let voiceNote = null;

    // ✅ Handle media file upload
    if (mediaFile) {
      console.log("🖼️ Uploading media:", mediaFile.originalname, mediaFile.mimetype);
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

    // ✅ Handle voice note upload with debug logs
    if (voiceNoteFile) {
      try {
        console.log("🎤 Uploading voice note:", voiceNoteFile.originalname, voiceNoteFile.mimetype);
        console.log("🧠 voiceNoteFile buffer length:", voiceNoteFile?.buffer?.length);

        const uploadResult = await uploadToCloudinary(voiceNoteFile, "whatsapp-clone");
        voiceNote = {
          url: uploadResult.secure_url,
          duration: Number(duration) || 0,
        };
      } catch (error) {
        console.error("❌ Voice upload error:", error.message);
        return res.status(500).json({ success: false, message: error.message });
      }
    }

    // ✅ Create message
    const newMessage = await Message.create({
      conversationId,
      sender: senderId,
      text: text?.trim() || null,
      media,
      voiceNote,
      seenBy: [senderId],
      status: "sent",
    });

    // ✅ Update last message in conversation
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

    // ✅ Emit message via socket
    const populatedMessage = await newMessage.populate("sender", "name profilePic");
    req.app.locals.io.to(conversationId).emit("message-received", populatedMessage);

    res.status(201).json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error("❌ Send message error:", error.message);
    console.error(error.stack);
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

