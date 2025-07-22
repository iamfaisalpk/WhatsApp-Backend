import Conversation from "../Models/Conversation.js";
import ChatMeta from "../Models/ChatMeta.js";
import Message from "../Models/Message.js";
import User from "../Models/User.js";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

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
      console.log(" Existing chat found:", chat._id);

      // Unhide if needed
      if (
        Array.isArray(chat.hiddenFor) &&
        chat.hiddenFor.includes(currentUserId)
      ) {
        chat.hiddenFor = chat.hiddenFor.filter(
          (id) => id.toString() !== currentUserId.toString()
        );
        await chat.save();
        console.log(" Chat unhidden for current user");
      }

      chat = await Conversation.findById(chat._id).populate(
        "members",
        "name profilePic isOnline lastSeen about phone"
      );

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

      if (io) {
        io.to(currentUserId).emit("chat list updated");
        io.to(userId).emit("chat list updated");
      }

      return res.status(200).json({ success: true, chat });
    }

    console.log("Creating new one-to-one chat");

    const newChat = await Conversation.create({
      isGroup: false,
      members: [currentUserId, userId],
    });

    const fullChat = await Conversation.findById(newChat._id).populate(
      "members",
      "name profilePic isOnline lastSeen about phone"
    );

    await Promise.all(
      [currentUserId, userId].map((id) =>
        ChatMeta.findOneAndUpdate(
          { user: id, chat: newChat._id },
          { $setOnInsert: { isRead: true , isFavorite: false} },
          { upsert: true, new: true }
        )
      )
    );

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
      .select(
        "members isGroup groupName groupAvatar groupDescription lastMessage updatedAt createdAt groupAdmin inviteToken"
      )
      .populate(
        "members",
        "name profilePic isOnline lastSeen savedName phone isBlocked isBlockedByMe about"
      )
      .populate("groupAdmin", "name profilePic about phone")
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
        }

        return {
          ...chatObj,
          groupAvatar: chatObj.isGroup ? chatObj.groupAvatar || "" : undefined,
          groupDescription: chatObj.isGroup
            ? chatObj.groupDescription || ""
            : undefined,
          isFavorite: meta?.isFavorite === true,
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
  console.log(" [createGroupChat] called");
  console.log(" User:", req.user);
  console.log(" Body:", req.body);
  console.log(" File received:", req.file);

  let { members, groupName, groupDescription } = req.body;
  const groupAvatar = req.file?.path || "";

  if (!members || !groupName) {
    return res
      .status(400)
      .json({ message: "Members and group name are required" });
  }

  groupDescription = groupDescription || "";

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
      groupDescription,
      members: allUsers,
      groupAdmin: req.user.id,
      inviteToken: uuidv4(),
    });

    const fullGroupChat = await Conversation.findById(groupChat._id)
      .populate("members", "name profilePic isOnline lastSeen about phone")
      .populate("groupAdmin", "name profilePic about phone");

    console.log(" Group Created:", fullGroupChat._id);
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
      .populate("members", "name profilePic isOnline lastSeen about phone")
      .populate("groupAdmin", "name profilePic about phone");

    if (!updatedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const io = req.app.locals.io;
    io.to(chatId).emit("group description updated", {
      chatId,
    });

    res.status(200).json({ success: true, updatedChat });
  } catch (error) {
    console.error("Rename Group Error:", error);
    res.status(500).json({
      message: "Failed to rename group",
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
      .populate("members", "name profilePic phone about")
      .populate("groupAdmin", "name profilePic phone about")
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
  console.log("what is issuefor toogle",chatId)
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
      meta = await ChatMeta.create({
        user: req.user.id,
        chat: chatId,
        isFavorite: false, 
      });
    } else {
      meta.isFavorite = !meta.isFavorite;
      await meta.save();
    }

    return res.status(200).json({
      success: true,
      message: "Favorite status updated",
      isFavorite: meta.isFavorite,
    });
  } catch (error) {
    console.error("Toggle Favorite Error:", error);
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
    console.error(" Mute Error:", error);
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
    console.error(" Archive Error:", error);
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
      .populate("members", "name profilePic isOnline lastSeen about phone")
      .populate("groupAdmin", "name profilePic about phone");

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

export const joinGroupViaInvite = async (req, res) => {
  const { inviteToken } = req.params;
  const userId = req.user.id;

  try {
    const group = await Conversation.findOne({ inviteToken });

    if (!group || !group.isGroup) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.members.includes(userId)) {
      return res.status(400).json({ message: "Already a member" });
    }

    group.members.push(userId);
    await group.save();

    const fullGroup = await Conversation.findById(group._id)
      .populate("members", "name profilePic isOnline lastSeen about phone")
      .populate("groupAdmin", "name profilePic about phone");

    const io = req.app.locals.io;

    const onlineSocketId = [...io.sockets.sockets.values()].find(
      (s) => s.userId === userId
    )?.id;

    if (onlineSocketId) {
      io.to(onlineSocketId).emit("chat list updated", fullGroup);
    }

    res.status(200).json({
      success: true,
      message: "Joined group successfully",
      group: fullGroup,
    });
  } catch (error) {
    console.error("Join group error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getGroupInfo = async (req, res) => {
  const { chatId } = req.params;

  if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid Chat ID",
    });
  }

  try {
    const chat = await Conversation.findById(chatId)
      .populate("members", "name profilePic isOnline lastSeen phone about")
      .populate("groupAdmin", "name profilePic phone about")
      .populate("groupDescriptionUpdatedBy", "name profilePic");

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Check if user is a member
    if (!chat.members.some((member) => member._id.toString() === req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    const groupInfo = {
      ...chat.toObject(),
      inviteToken: chat.inviteToken,
      groupDescription: chat.groupDescription || "",
      groupDescriptionLastUpdated: chat.groupDescriptionLastUpdated,
      groupDescriptionUpdatedBy: chat.groupDescriptionUpdatedBy,
    };

    res.status(200).json({
      success: true,
      group: groupInfo,
    });
  } catch (error) {
    console.error(" Get Group Info Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch group info",
      error: error.message,
    });
  }
};

export const updateGroupDescription = async (req, res) => {
  const { chatId } = req.params;
  const { description } = req.body;
  const userId = req.user.id;

  if (!chatId || description === undefined) {
    return res.status(400).json({
      success: false,
      message: "chatId and description are required",
    });
  }

  try {
    const chat = await Conversation.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!chat.isGroup) {
      return res.status(400).json({
        success: false,
        message: "Not a group chat",
      });
    }

    if (chat.groupAdmin.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only admin can update description",
      });
    }

    chat.groupDescription = description.trim();
    chat.groupDescriptionLastUpdated = new Date();
    chat.groupDescriptionUpdatedBy = userId;
    await chat.save();

    const updatedChat = await Conversation.findById(chatId)
      .populate("members", "name profilePic isOnline lastSeen about phone")
      .populate("groupAdmin", "name profilePic about phone")
      .populate("groupDescriptionUpdatedBy", "name profilePic");

    return res.status(200).json({
      success: true,
      message: "Group description updated successfully",
      chat: updatedChat,
    });
  } catch (err) {
    console.error("Update Group Description Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update group description",
      error: err.message,
    });
  }
};

export const inviteGroupPreview = async (req, res) => {
  const { inviteToken } = req.params;

  try {
    const group = await Conversation.findOne({ inviteToken })
      .populate("members", "name profilePic")
      .populate("groupAdmin", "name profilePic");

    if (!group || !group.isGroup) {
      return res
        .status(404)
        .json({ message: "Group not found or invalid token" });
    }

    res.status(200).json({
      success: true,
      group,
    });
  } catch (err) {
    console.error("Invite preview error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
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

  const userId = req.user.id;

  try {
    const chat = await Conversation.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.isGroup) {
      return res.status(400).json({ message: "This is not a group chat" });
    }

    if (!chat.members.includes(userId)) {
      return res.status(400).json({ message: "You are not a member" });
    }

    let updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      { $pull: { members: userId } },
      { new: true }
    );

    if (!updatedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    updatedChat = await updatedChat.populate(
      "members",
      "-password -refreshToken"
    );

    const io = req.app.locals.io;

    io.to(chatId).emit("left-group", {
      chatId,
      userId,
    });

    res.status(200).json({ success: true, chat: updatedChat });
  } catch (error) {
    console.error("Leave Group Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to leave group",
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
    const chat = await Conversation.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.isGroup) {
      return res.status(400).json({ message: "This is not a group chat" });
    }

    if (chat.members.includes(userId)) {
      return res.status(400).json({ message: "User is already a member" });
    }

    const updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      { $push: { members: userId } },
      { new: true }
    )
      .populate("members", "name profilePic isOnline lastSeen about phone")
      .populate("groupAdmin", "name profilePic about phone");

    if (!updatedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const io = req.app.locals.io;

    io.to(chatId).emit("user-added-to-group", {
      chatId,
      userId,
      updatedChat,
    });

    const onlineSocketId = [...io.sockets.sockets.values()].find(
      (s) => s.userId === userId
    )?.id;

    if (onlineSocketId) {
      io.to(onlineSocketId).emit("chat list updated", updatedChat);
    }

    res.status(200).json({ success: true, updatedChat });
  } catch (error) {
    console.error("Add to Group Error:", error);
    res.status(500).json({
      success: false,
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
    const chat = await Conversation.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.isGroup) {
      return res.status(400).json({ message: "This is not a group chat" });
    }

    if (!chat.members.includes(userId)) {
      return res.status(400).json({ message: "User is not a member" });
    }

    const updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      { $pull: { members: userId } },
      { new: true }
    )
      .populate("members", "name profilePic isOnline lastSeen about phone")
      .populate("groupAdmin", "name profilePic about phone");

    if (!updatedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const io = req.app.locals.io;

    io.to(chatId).emit("user-removed-from-group", {
      chatId,
      userId,
    });

    const removedSocketId = [...io.sockets.sockets.values()].find(
      (s) => s.userId === userId
    )?.id;

    if (removedSocketId) {
      io.to(removedSocketId).emit("chat list updated", updatedChat);
    }

    res.status(200).json({ success: true, updatedChat });
  } catch (error) {
    console.error("Remove from Group Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove user",
      error: error.message,
    });
  }
};
