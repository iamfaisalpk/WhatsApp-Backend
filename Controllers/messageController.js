import Message from "../Models/Message.js";
import Conversation from "../Models/Conversation.js";
import { uploadToCloudinary } from "../Utils/uploadToCloudinary.js"; 

export const sendMessage = async (req, res) => {
  try {
    const { conversationId, text, duration } = req.body;
    const senderId = req.user.id;
    const file = req.file;

    if (!conversationId || (!text && !file)) {
      return res.status(400).json({
        success: false,
        message: "Text, media, or voice note is required",
      });
    }

    let media = null;
    let voiceNote = null;

    // ✅ Uploading to Cloudinary
    if (file) {
      const uploadResult = await uploadToCloudinary(file.path, "chats");

      const fileType = file.mimetype;

      if (fileType.startsWith("audio") && duration) {
        // Voice note
        voiceNote = {
          url: uploadResult.secure_url,
          duration: Number(duration),
        };
      } else {
        // Image, video, or file
        const type = fileType.startsWith("image")
          ? "image"
          : fileType.startsWith("video")
          ? "video"
          : fileType.startsWith("audio")
          ? "audio"
          : "file";

        media = {
          url: uploadResult.secure_url,
          type,
        };
      }
    }

    // ✅ Create and save message
    const newMessage = await Message.create({
      conversationId,
      sender: senderId,
      text: text?.trim() || null,
      media,
      voiceNote,
      seenBy: [senderId],
    });

    // ✅ Update conversation with lastMessage
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

    const populatedMessage = await newMessage.populate("sender", "name profilePic");

    // ✅ Emit to socket
    req.app.locals.io.to(conversationId).emit("newMessage", populatedMessage);

    res.status(201).json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error("Send message error:", error);
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

    res.status(200).json({ success: true, message: "Chat and messages deleted" });
  } catch (error) {
    console.error("Delete Chat Error:", error);
    res.status(500).json({ message: "Failed to delete chat" });
  }
};

export const clearChatMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    await Message.deleteMany({ conversationId });

    res.status(200).json({ success: true, message: "Chat cleared successfully" });
  } catch (error) {
    console.error("Clear Chat Error:", error);
    res.status(500).json({ message: "Failed to clear chat" });
  }
};
