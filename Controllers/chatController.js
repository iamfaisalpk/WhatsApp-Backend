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

export const fetchChats = async (req, res) => {
  try {
    const chats = await Conversation.find({
      members: req.user.id,
    })
      .select("members isGroup groupName groupAvatar lastMessage updatedAt")
      .populate(
        "members",
        "name profilePic isOnline lastSeen savedName phone isBlocked isBlockedByMe"
      )
      .populate("groupAdmin", "-otp -__v")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "name profilePic",
        },
      })
      .sort({ updatedAt: -1 });

    // Debug: Log what we get from database
    console.log(
      "Raw chats from DB:",
      chats.map((chat) => ({
        id: chat._id,
        isGroup: chat.isGroup,
        groupName: chat.groupName,
        groupAvatar: chat.groupAvatar,
      }))
    );

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

        const chatObj = chat.toObject({ getters: true });

        // Debug: Log chatObj to see what toObject returns
        if (chatObj.isGroup) {
          console.log("ChatObj for group:", {
            id: chatObj._id,
            groupName: chatObj.groupName,
            groupAvatar: chatObj.groupAvatar,
          });
        }

        // Count unread messages for this chat
        const unreadCount = await Message.countDocuments({
          conversationId: chat._id,
          sender: { $ne: req.user.id },
          readBy: { $ne: req.user.id },
        });

        const finalChat = {
          ...chatObj,
          // ChatMeta properties
          isFavorite: meta?.isFavorite || false,
          isRead: meta?.isRead !== false,
          muted: meta?.muted || false,
          archived: meta?.archived || false,
          isPinned: meta?.pinned || false,
          unreadCount,
        };

        // Debug: Log final chat object for groups
        if (finalChat.isGroup) {
          console.log("Final chat object for group:", {
            id: finalChat._id,
            groupName: finalChat.groupName,
            groupAvatar: finalChat.groupAvatar,
          });
        }

        return finalChat;
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
  let { members, groupName } = req.body;
  const groupAvatar = req.file?.path || "";

  if (!members || !groupName) {
    return res
      .status(400)
      .json({ message: "Members and group name are required" });
  }

  //  Fix: Parse if it's a JSON string
  if (typeof members === "string") {
    try {
      members = JSON.parse(members);
    } catch (err) {
      return res.status(400).json({ message: "Invalid members format" });
    }
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
    if (!chat.members.includes(req.user.id)) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }
    await ChatMeta.deleteMany({ chat: chatId });

    await Message.deleteMany({ conversationId: chatId });
    await chat.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Chat deleted successfully" });
  } catch (error) {
    console.error("❌ Delete Chat Error:", error);
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

//  Get Shared Groups Between Two Users
export const getSharedGroups = async (req, res) => {
  const { userId } = req.params;

  try {
    const sharedGroups = await Conversation.find({
      isGroup: true,
      members: { $all: [req.user.id, userId] },
    })
      .populate("members", "name profilePic phone")
      .populate("groupAdmin", "name profilePic phone")
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, groups: sharedGroups });
  } catch (error) {
    console.error("Get Shared Groups Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch shared groups" });
  }
};

// ✅ Toggle Favorite
export const toggleFavorite = async (req, res) => {
  const { chatId } = req.params;

  try {
    let meta = await ChatMeta.findOne({
      user: req.user.id,
      chat: chatId,
    });

    if (!meta) {
      // If not found, create one
      meta = await ChatMeta.create({
        user: req.user.id,
        chat: chatId,
        isFavorite: true,
      });
    } else {
      // Toggle the value
      meta.isFavorite = !meta.isFavorite;
      await meta.save();
    }

    return res.status(200).json({
      success: true,
      message: "Favorite status updated",
      isFavorite: meta.isFavorite,
    });
  } catch (error) {
    console.error("Toggle Favorite Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update favorite status",
    });
  }
};

export const toggleMuteChat = async (req, res) => {
  const { chatId } = req.params;

  try {
    const meta = await ChatMeta.findOne({ user: req.user.id, chat: chatId });
    if (!meta) return res.status(404).json({ message: "ChatMeta not found" });

    meta.muted = !meta.muted;
    await meta.save();

    res.status(200).json({
      success: true,
      message: `Chat ${meta.muted ? "muted" : "unmuted"}`,
    });
  } catch (error) {
    console.error("Mute Error:", error);
    res.status(500).json({ message: "Failed to toggle mute" });
  }
};

export const toggleArchiveChat = async (req, res) => {
  const { chatId } = req.params;

  try {
    const meta = await ChatMeta.findOne({ user: req.user.id, chat: chatId });
    if (!meta) return res.status(404).json({ message: "ChatMeta not found" });

    meta.archived = !meta.archived;
    await meta.save();

    res.status(200).json({
      success: true,
      message: `Chat ${meta.archived ? "archived" : "unarchived"}`,
    });
  } catch (error) {
    console.error("Archive Error:", error);
    res.status(500).json({ message: "Failed to toggle archive" });
  }
};

export const togglePinChat = async (req, res) => {
  const { chatId } = req.params;

  try {
    const meta = await ChatMeta.findOne({ user: req.user.id, chat: chatId });
    if (!meta) return res.status(404).json({ message: "ChatMeta not found" });

    meta.pinned = !meta.pinned;
    await meta.save();

    res.status(200).json({
      success: true,
      message: `Chat ${meta.pinned ? "pinned" : "unpinned"}`,
    });
  } catch (error) {
    console.error("Pin Error:", error);
    res.status(500).json({ message: "Failed to toggle pin" });
  }
};

// Add this function to your existing chatController.js file

export const updateGroupAvatar = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  try {
    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Find the chat and verify it exists
    const chat = await Conversation.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Check if it's a group chat
    if (!chat.isGroup) {
      return res.status(400).json({
        success: false,
        message: "This is not a group chat",
      });
    }

    // Check if user is group admin
    if (chat.groupAdmin.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only group admin can update group avatar",
      });
    }

    // Since you're using CloudinaryStorage, req.file.path contains the Cloudinary URL
    const groupAvatar = req.file.path;

    // Update the chat with new avatar
    const updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      { groupAvatar },
      { new: true }
    )
      .populate("members", "name profilePic isOnline lastSeen")
      .populate("groupAdmin", "name profilePic");

    res.status(200).json({
      success: true,
      message: "Group avatar updated successfully",
      chat: updatedChat,
      updatedChat: updatedChat,
      groupAvatar,
    });
  } catch (error) {
    console.error("❌ Update group avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating group avatar",
      error: error.message,
    });
  }
};
