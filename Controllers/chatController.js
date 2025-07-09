import Conversation from "../Models/Conversation.js";
import ChatMeta from "../Models/ChatMeta.js";
import User from "../Models/User.js";
import Message from "../Models/Message.js";

//  Access One-to-One Chat
export const accessChat = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "User ID is required" });
  }

  try {
    //  Block Check
    const targetUser = await User.findById(userId);
    if (targetUser.blockedUsers.includes(req.user.id)) {
      return res.status(403).json({ message: "You are blocked by this user." });
    }

    //  Check if chat exists
    let chat = await Conversation.findOne({
      isGroup: false,
      members: { $all: [req.user.id, userId], $size: 2 },
    }).populate("members", "name profilePic isOnline lastSeen");

    if (chat) {
      const userIds = [req.user.id, userId];

      const metaResults = await Promise.all(
        userIds.map((id) =>
          ChatMeta.findOneAndUpdate(
            { user: id, chat: chat._id },
            { $setOnInsert: { isRead: true } },
            { upsert: true, new: true }
          )
        )
      );

      return res.status(200).json({ success: true, chat });
    }

    //  Create New Chat
    const newChat = await Conversation.create({
      isGroup: false,
      members: [req.user.id, userId],
    });

    const fullChat = await Conversation.findById(newChat._id).populate(
      "members",
      "name profilePic isOnline lastSeen"
    );

    const userIds = [req.user.id, userId];

    const metaResults = await Promise.all(
      userIds.map((id) =>
        ChatMeta.findOneAndUpdate(
          { user: id, chat: newChat._id },
          { $setOnInsert: { isRead: true } },
          { upsert: true, new: true }
        )
      )
    );

    return res.status(201).json({ success: true, chat: fullChat });
  } catch (error) {
    console.error("Access Chat Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

//  Get User Chats
export const fetchChats = async (req, res) => {
  try {
    const chats = await Conversation.find({
      members: req.user.id,
    })
      .populate("members", "name profilePic isOnline lastSeen")
      .populate("groupAdmin", "-otp -__v")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "name profilePic",
        },
      })
      .sort({ updatedAt: -1 });

    const chatsWithMeta = await Promise.all(
      chats.map(async (chat) => {
        let meta = await ChatMeta.findOne({
          user: req.user.id,
          chat: chat._id,
        });

        if (!meta) {
          meta = await ChatMeta.create({
            user: req.user.id,
            chat: chat._id,
            isRead: true,
          });
        }

        return {
          ...chat.toObject(),
          isFavorite: meta.isFavorite || false,
          isRead: meta.isRead !== false,
        };
      })
    );

    return res.status(200).json({ success: true, chats: chatsWithMeta });
  } catch (error) {
    console.error("Fetch Chats Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to fetch chats" });
  }
};

//  Group Chat Creation
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
      .populate("members", "name profilePic isOnline lastSeen")
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
      .populate("members", "name profilePic isOnline lastSeen")
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
      .populate("members", "name profilePic isOnline lastSeen")
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
      .populate("members", "name profilePic isOnline lastSeen")
      .populate("groupAdmin", "-otp -__v");

    res.status(200).json({ success: true, updatedChat });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove user" });
  }
};

export const deleteChat = async (req, res) => {
  const { chatId } = req.params;
  try {
    const chat = await Conversation.findById(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    await chat.deleteOne();
    res.status(200).json({ success: true, message: "Chat deleted" });
  } catch (error) {
    console.error("Delete Chat Error:", error);
    res.status(500).json({ message: "Failed to delete chat" });
  }
};

export const leaveGroup = async (req, res) => {
  const { chatId } = req.body;
  try {
    const updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      { $pull: { members: req.user.id } },
      { new: true }
    );
    res.status(200).json({ success: true, chat: updatedChat });
  } catch (error) {
    res.status(500).json({ message: "Failed to leave group" });
  }
};

export const clearChat = async (req, res) => {
  const { chatId } = req.params;
  try {
    await Message.deleteMany({ conversationId: chatId });
    res.status(200).json({ success: true, message: "Chat cleared" });
  } catch (error) {
    console.error("Clear Chat Error:", error);
    res.status(500).json({ message: "Failed to clear chat" });
  }
};
