import Conversation from "../Models/Conversation.js";
import ChatMeta from "../Models/ChatMeta.js";
import Message from "../Models/Message.js";
import User from "../Models/User.js";
import mongoose from "mongoose";

export const accessChat = async (req, res) => {
  const { userId } = req.body;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      success: false,
      message: "Valid user ID is required",
    });
  }

  try {
    const io = req.app.get("io");

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user access",
      });
    }

    const currentUserId = req.user.id;
    console.log(" accessChat triggered");
    console.log(" Auth User:", currentUserId);
    console.log(" Target User:", userId);

    // Fetch and validate target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target user not found",
      });
    }

    // Check if blocked
    if (targetUser.blockedUsers?.includes(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "You are blocked by this user",
      });
    }

    // Find existing one-to-one chat
    let chat = await Conversation.findOne({
      isGroup: false,
      members: { $all: [currentUserId, userId], $size: 2 },
    });

    if (chat) {
      console.log("🟢 Existing chat found:", chat._id);

      // Unhide if needed
      if (
        Array.isArray(chat.hiddenFor) &&
        chat.hiddenFor.includes(currentUserId)
      ) {
        chat.hiddenFor = chat.hiddenFor.filter(
          (id) => id.toString() !== currentUserId.toString()
        );
        await chat.save();
        console.log("👁️ Chat unhidden for current user");
      }

      // Repopulate with member details
      chat = await Conversation.findById(chat._id).populate(
        "members",
        "name profilePic isOnline lastSeen"
      );

      // Ensure ChatMeta exists
      const userIds = [currentUserId, userId];
      await Promise.all(
        userIds.map((id) =>
          ChatMeta.findOneAndUpdate(
            { user: id, chat: chat._id },
            { $setOnInsert: { isRead: true } },
            { upsert: true, new: true }
          )
        )
      );

      // ✅ Fixed: Added null check for io
      if (io) {
        io.to(currentUserId).emit("chat list updated");
        io.to(userId).emit("chat list updated");
      }

      return res.status(200).json({ success: true, chat });
    }

    // Create new chat if not exists
    console.log("🆕 Creating new one-to-one chat");

    const newChat = await Conversation.create({
      isGroup: false,
      members: [currentUserId, userId],
    });

    const fullChat = await Conversation.findById(newChat._id).populate(
      "members",
      "name profilePic isOnline lastSeen"
    );

    // Create ChatMeta for both users
    await Promise.all(
      [currentUserId, userId].map((id) =>
        ChatMeta.findOneAndUpdate(
          { user: id, chat: newChat._id },
          { $setOnInsert: { isRead: true } },
          { upsert: true, new: true }
        )
      )
    );

    // ✅ Fixed: Added null check for io
    if (io) {
      io.to(currentUserId).emit("chat list updated");
      io.to(userId).emit("chat list updated");
    }

    return res.status(201).json({ success: true, chat: fullChat });
  } catch (error) {
    console.error(" accessChat error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while accessing chat",
      error: error.message,
    });
  }
};

export const fetchChats = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - no user found",
      });
    }

    const chats = await Conversation.find({
      members: req.user.id,
      hiddenFor: { $ne: req.user.id },
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

        if (!chatObj.isGroup) {
          const otherUser = chatObj.members.find(
            (m) => String(m._id) !== String(req.user.id)
          );

          if (
            otherUser?.isBlocked === true || 
            otherUser?.isBlockedByMe === true
          ) {
            return null; 
          }
        }

        let unreadCount = 0;
        try {
          unreadCount = await Message.countDocuments({
            conversationId: chat._id,
            sender: { $ne: req.user.id },
            readBy: { $ne: req.user.id },
          });
        } catch (countError) {
          console.error("Error counting unread messages:", countError);
          // Continue with unreadCount = 0
        }

        return {
          ...chatObj,
          groupAvatar: chatObj.isGroup ? chatObj.groupAvatar || "" : undefined,
          isFavorite: meta?.isFavorite || false,
          isRead: meta?.isRead !== false,
          muted: meta?.muted || false,
          archived: meta?.archived || false,
          isPinned: meta?.pinned || false,
          isArchived: meta?.archived || false,
          unreadCount,
        };
      })
    );

    const visibleChats = chatsWithMeta.filter((chat) => chat !== null);

    const archivedChats = visibleChats.filter((chat) => chat.isArchived);
    const activeChats = visibleChats.filter((chat) => !chat.isArchived);

    return res.status(200).json({
      success: true,
      activeChats,
      archivedChats,
    });
  } catch (error) {
    console.error(" Fetch Chats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch chats",
      error: error.message,
    });
  }
};

// Group Chat Creation
export const createGroupChat = async (req, res) => {
  let { members, groupName } = req.body;
  const groupAvatar = req.file?.path || "";

  if (!members || !groupName) {
    return res
      .status(400)
      .json({ message: "Members and group name are required" });
  }

  if (typeof members === "string") {
    try {
      members = JSON.parse(members);
    } catch (err) {
      return res.status(400).json({ message: "Invalid members format" });
    }
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
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
    console.error(" Create Group Chat Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create group",
      error: error.message,
    });
  }
};

export const renameGroup = async (req, res) => {
  const { chatId, groupName } = req.body;

  if (!chatId || !groupName) {
    return res
      .status(400)
      .json({ message: "Chat ID and group name are required" });
  }

  try {
    const updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      { groupName },
      { new: true }
    )
      .populate("members", "name profilePic isOnline lastSeen")
      .populate("groupAdmin", "-otp -__v");

    if (!updatedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.status(200).json({ success: true, updatedChat });
  } catch (error) {
    console.error("Rename Group Error:", error);
    res.status(500).json({
      message: "Failed to rename group",
      error: error.message,
    });
  }
};

export const addToGroup = async (req, res) => {
  const { chatId, userId } = req.body;

  if (!chatId || !userId) {
    return res
      .status(400)
      .json({ message: "Chat ID and user ID are required" });
  }

  try {
    const updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      { $push: { members: userId } },
      { new: true }
    )
      .populate("members", "name profilePic isOnline lastSeen")
      .populate("groupAdmin", "-otp -__v");

    if (!updatedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.status(200).json({ success: true, updatedChat });
  } catch (error) {
    console.error(" Add to Group Error:", error);
    res.status(500).json({
      message: "Failed to add user",
      error: error.message,
    });
  }
};

export const removeFromGroup = async (req, res) => {
  const { chatId, userId } = req.body;

  if (!chatId || !userId) {
    return res
      .status(400)
      .json({ message: "Chat ID and user ID are required" });
  }

  try {
    const updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      { $pull: { members: userId } },
      { new: true }
    )
      .populate("members", "name profilePic isOnline lastSeen")
      .populate("groupAdmin", "-otp -__v");

    if (!updatedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.status(200).json({ success: true, updatedChat });
  } catch (error) {
    console.error("Remove from Group Error:", error);
    res.status(500).json({
      message: "Failed to remove user",
      error: error.message,
    });
  }
};

export const deleteChat = async (req, res) => {
  const { chatId } = req.params;

  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (!chatId) {
    return res
      .status(400)
      .json({ success: false, message: "Chat ID is required" });
  }

  try {
    const chat = await Conversation.findById(chatId);

    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    }

    if (!chat.members.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this chat",
      });
    }

    if (chat.hiddenFor?.includes(req.user.id)) {
      return res.status(200).json({
        success: true,
        message: "Chat already deleted for this user",
      });
    }

    if (chat.isGroup && chat.groupAdmin.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only group admin can delete this group chat",
      });
    }

    await ChatMeta.deleteMany({ chat: chatId, user: req.user.id });
    await Conversation.findByIdAndUpdate(chatId, {
      $addToSet: { hiddenFor: req.user.id },
    });

    const io = req.app.get("io");
    if (io) {
      io.to(req.user.id).emit("chat list updated");
    }

    return res.status(200).json({
      success: true,
      message: "Chat deleted successfully for this user",
    });
  } catch (error) {
    console.error(" Delete Chat Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete chat",
      error: error.message,
    });
  }
};

export const leaveGroup = async (req, res) => {
  const { chatId } = req.body;

  if (!chatId) {
    return res.status(400).json({ message: "Chat ID is required" });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      { $pull: { members: req.user.id } },
      { new: true }
    );

    if (!updatedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.status(200).json({ success: true, chat: updatedChat });
  } catch (error) {
    console.error("Leave Group Error:", error);
    res.status(500).json({
      message: "Failed to leave group",
      error: error.message,
    });
  }
};

export const clearChat = async (req, res) => {
  const { chatId } = req.params;

  if (!chatId) {
    return res.status(400).json({ message: "Chat ID is required" });
  }

  try {
    await Message.deleteMany({ conversationId: chatId });
    res.status(200).json({ success: true, message: "Chat cleared" });
  } catch (error) {
    console.error(" Clear Chat Error:", error);
    res.status(500).json({
      message: "Failed to clear chat",
      error: error.message,
    });
  }
};

// Get Shared Groups Between Two Users
export const getSharedGroups = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

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
    console.error(" Get Shared Groups Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shared groups",
      error: error.message,
    });
  }
};

export const toggleFavorite = async (req, res) => {
  const { chatId } = req.params;

  if (!chatId) {
    return res.status(400).json({ message: "Chat ID is required" });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

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
    console.error(" Toggle Favorite Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update favorite status",
      error: error.message,
    });
  }
};

export const toggleMuteChat = async (req, res) => {
  const { chatId } = req.params;

  if (!chatId) {
    return res.status(400).json({ message: "Chat ID is required" });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const meta = await ChatMeta.findOne({ user: req.user.id, chat: chatId });
    if (!meta) {
      return res.status(404).json({ message: "ChatMeta not found" });
    }

    meta.muted = !meta.muted;
    await meta.save();

    res.status(200).json({
      success: true,
      message: `Chat ${meta.muted ? "muted" : "unmuted"}`,
    });
  } catch (error) {
    console.error("❌ Mute Error:", error);
    res.status(500).json({
      message: "Failed to toggle mute",
      error: error.message,
    });
  }
};

export const toggleArchiveChat = async (req, res) => {
  const { chatId } = req.params;

  if (!chatId) {
    return res.status(400).json({ message: "Chat ID is required" });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const meta = await ChatMeta.findOne({ user: req.user.id, chat: chatId });
    if (!meta) {
      return res.status(404).json({ message: "ChatMeta not found" });
    }

    meta.archived = !meta.archived;
    await meta.save();

    res.status(200).json({
      success: true,
      message: `Chat ${meta.archived ? "archived" : "unarchived"}`,
    });
  } catch (error) {
    console.error("❌ Archive Error:", error);
    res.status(500).json({
      message: "Failed to toggle archive",
      error: error.message,
    });
  }
};

export const togglePinChat = async (req, res) => {
  const { chatId } = req.params;

  if (!chatId) {
    return res.status(400).json({ message: "Chat ID is required" });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const meta = await ChatMeta.findOne({ user: req.user.id, chat: chatId });
    if (!meta) {
      return res.status(404).json({ message: "ChatMeta not found" });
    }

    meta.pinned = !meta.pinned;
    await meta.save();

    res.status(200).json({
      success: true,
      message: `Chat ${meta.pinned ? "pinned" : "unpinned"}`,
    });
  } catch (error) {
    console.error("Pin Error:", error);
    res.status(500).json({
      message: "Failed to toggle pin",
      error: error.message,
    });
  }
};

export const updateGroupAvatar = async (req, res) => {
  const { chatId } = req.params;

  if (!chatId) {
    return res.status(400).json({ message: "Chat ID is required" });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = req.user.id;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const chat = await Conversation.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    if (!chat.isGroup) {
      return res.status(400).json({
        success: false,
        message: "This is not a group chat",
      });
    }

    if (chat.groupAdmin.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only group admin can update group avatar",
      });
    }

    const groupAvatar = req.file.path;

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
    console.error(" Update group avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating group avatar",
      error: error.message,
    });
  }
};
