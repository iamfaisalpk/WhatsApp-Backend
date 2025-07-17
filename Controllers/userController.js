import User from "../Models/User.js";

//  Search Users
// Search Users (with phone, name, or username)
export const searchUsers = async (req, res) => {
  try {
    const search = req.query.search || "";

    // Build dynamic search query
    const keyword = search
      ? {
          $or: [
            { phone: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
            { username: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const users = await User.find({
      ...keyword,
      _id: { $ne: req.user._id }, 
    }).select("name phone username profilePic isOnline");

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    res.json(users);
  } catch (err) {
    console.error(" Error in searchUsers:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

//  Get User Profile by ID with Block Check
export const getUserById = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id).select("-password");

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const isBlocked = targetUser.blockedUsers.includes(req.user.id);

    if (isBlocked && targetUser.isProfilePublic === false) {
      return res.status(403).json({ message: "You are blocked by this user." });
    }

    res.json(targetUser);
  } catch (err) {
    console.error(" Error in getUserById:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//  Block a User
export const blockUser = async (req, res) => {
  try {
    const blocker = await User.findById(req.user.id);
    const blockedId = req.params.id;

    if (blocker.blockedUsers.includes(blockedId)) {
      return res.status(400).json({ message: "User already blocked." });
    }

    blocker.blockedUsers.push(blockedId);
    await blocker.save();

    const blocked = await User.findById(blockedId);
    blocked.blockedBy.push(req.user.id);
    await blocked.save();

    // 🔥 Emit to self (blocker)
    req.app.locals.io.to(req.user.id).emit("block status updated");

    res.json({ message: "User blocked successfully." });
  } catch (err) {
    console.error(" Error in blockUser:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//  Unblock a User
export const unblockUser = async (req, res) => {
  try {
    const blocker = await User.findById(req.user.id);
    const blockedId = req.params.id;

    blocker.blockedUsers = blocker.blockedUsers.filter(
      (userId) => userId.toString() !== blockedId
    );
    await blocker.save();

    const blocked = await User.findById(blockedId);
    blocked.blockedBy = blocked.blockedBy.filter(
      (userId) => userId.toString() !== req.user.id
    );
    await blocked.save();

    // Emit to self (blocker)
    req.app.locals.io.to(req.user.id).emit("block status updated");

    res.json({ message: "User unblocked successfully." });
  } catch (err) {
    console.error(" Error in unblockUser:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//  Get Blocked Users List
export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("blockedUsers", "name phone profilePic")
      .populate("blockedBy", "name phone profilePic");

    res.json({
      iBlocked: user.blockedUsers,
      blockedMe: user.blockedBy,
    });
  } catch (err) {
    console.error("Error in getBlockedUsers:", err);
    res.status(500).json({ message: "Server error" });
  }
};
