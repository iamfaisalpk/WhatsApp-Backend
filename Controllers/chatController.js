import Conversation from '../Models/Conversation.js';

export const accessChat = async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: "UserId required" });
    }

    try {
        let chat = await Conversation.findOne({
            isGroup: false,
            members: { $all: [req.user.id, userId] }
        }).populate("members", "-otp -__v");

        if (chat) {
            return res.status(200).json({ success: true, chat });
        }

        // If chat doesn’t exist, create it
        const newChat = await Conversation.create({
            isGroup: false,
            members: [req.user.id, userId],
        });

        const fullChat = await Conversation.findById(newChat._id)
            .populate("members", "-otp -__v");

        return res.status(201).json({ success: true, chat: fullChat });

    } catch (error) {
        console.error("Access Chat Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};


export const fetchChats = async (req, res) => {
    try {
        const chats = await Conversation.find({
            members: { $in: [req.user.id] }
        })
            .populate("members", "-otp -__v")
            .populate("groupAdmin", "-otp -__v")
            .sort({ updatedAt: -1 });

        res.status(200).json({ success: true, chats });
    } catch (error) {
        console.error("Fetch Chats Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};
