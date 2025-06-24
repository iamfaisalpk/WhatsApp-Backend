import Message from "../Models/Message.js";
import Conversation from "../Models/Conversation.js";


export const sendMessage = async (req, res) => {
try {
    const { conversationId, text } = req.body;
    const media = req.file?.path;
    const senderId = req.user.id;

    if (!conversationId || (!text && !media)) {
        return res.status(400).json({ success: false, message: "Message or media is required" });
    }

    const newMessage = await Message.create({
        conversationId,
        sender: senderId,
        text: text?.trim(),
        media,
        seenBy: [senderId], 
    });

    await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: {
        text: newMessage.text || "📎 Media",
        sender: senderId,
        timestamp: newMessage.createdAt,
    }
    });

    const populateMessage = await newMessage.populate("sender","name profilePic")

    req.app.locals.io.to(conversationId).emit("newMessage", newMessage);

    res.status(201).json({ success: true, message: populateMessage });
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
