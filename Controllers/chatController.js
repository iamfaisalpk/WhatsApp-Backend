import Conversation from "../Models/Conversation.js";


export const accessChat = async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required" });
    }

    try {
        let chat = await Conversation.findOne({
            isGroup: false,
            members: { $all: [req.user.id, userId], $size: 2 }
        }).populate("members", "-otp -__v");

        if (chat) {
            return res.status(200).json({ success: true, chat });
        }

        const newChat = await Conversation.create({
            isGroup: false,
            members: [req.user.id, userId],
        });

        const fullChat = await Conversation.findById(newChat._id)
            .populate("members", "-otp -__v");

        return res.status(201).json({ success: true, chat: fullChat });

    } catch (error) {
        console.error("Access Chat Error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

export const fetchChats = async (req, res) => {
    try {
        const chats = await Conversation.find({
            members: req.user.id
        })
            .populate("members", "-otp -__v")
            .populate("groupAdmin", "-otp -__v")
            .sort({ updatedAt: -1 });

        return res.status(200).json({ success: true, chats });
    } catch (error) {
        console.error("Fetch Chats Error:", error);
        return res.status(500).json({ success: false, message: "Unable to fetch chats" });
    }
};

export const createGroupChat = async (req, res) => {
    const { members, groupName } = req.body;
    const groupAvatar = req.file?.path || "";

    if (!members || !groupName) {
        return res.status(400).json({ message: "Members and group name are required" });
    }

    const allUsers = [...members, req.user.id];

    try {
        const groupChat = await Conversation.create({
            isGroup: true,
            groupName,
            groupAvatar,
            members: allUsers,
            groupAdmin: req.user.id,
        });

        const fullGroupChat = await Conversation.findById(groupChat._id)
            .populate("members", "-otp -__v")
            .populate("groupAdmin", "-otp -__v");

        res.status(201).json({ success: true, group: fullGroupChat });
    } catch (error) {
        console.error("Create Group Chat Error:", error);
        res.status(500).json({ success: false, message: "Failed to create group" });
    }
};


export const renameGroup = async (req, res) => {
    const { chatId, groupName } = req.body;

    try {
        const updatedChat = await Conversation.findByIdAndUpdate(
            chatId,
            { groupName },
            { new: true }
        )
            .populate("members", "-otp -__v")
            .populate("groupAdmin", "-otp -__v");

        res.status(200).json({ success: true, updatedChat });
    } catch (error) {
        res.status(500).json({ message: "Failed to rename group" });
    }
};


export const addToGroup = async (req, res) => {
    const { chatId, userId } = req.body;

    try {
        const updatedChat = await Conversation.findByIdAndUpdate(
            chatId,
            { $push: { members: userId } },
            { new: true }
        )
            .populate("members", "-otp -__v")
            .populate("groupAdmin", "-otp -__v");

        res.status(200).json({ success: true, updatedChat });
    } catch (error) {
        res.status(500).json({ message: "Failed to add user" });
    }
};


export const removeFromGroup = async (req, res) => {
    const { chatId, userId } = req.body;

    try {
        const updatedChat = await Conversation.findByIdAndUpdate(
            chatId,
            { $pull: { members: userId } },
            { new: true }
        )
            .populate("members", "-otp -__v")
            .populate("groupAdmin", "-otp -__v");

        res.status(200).json({ success: true, updatedChat });
    } catch (error) {
        res.status(500).json({ message: "Failed to remove user" });
    }
};
