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
      _id: { $ne: req.user.id },
      isActive: { $ne: false } // Only show active users
    }).select("name phone username profilePic isOnline blockedBy blockedUsers");

    const sanitizedUsers = users.map(u => {
      const userObj = u.toObject();
      const isBlockedByMe = req.user.blockedUsers?.some(id => id.toString() === userObj._id.toString());
      const isBlockedByThem = userObj.blockedUsers?.some(id => id.toString() === req.user.id);
      
      if (isBlockedByThem) {
        userObj.profilePic = null; // They blocked me
        userObj.about = "Hidden";
        userObj.phone = "";
        // Note: We keep the name so the user knows who they are chatting with
      }
      userObj.isBlockedByMe = isBlockedByMe;
      userObj.isBlockedByThem = isBlockedByThem;
      return userObj;
    });

    if (!sanitizedUsers || sanitizedUsers.length === 0) {
      return res.status(200).json([]); // Return empty array instead of 404 for better UX
    }

    return res.json(sanitizedUsers);
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

    if (!blocker) {
      return res.status(404).json({ message: "Blocker user not found." });
    }

    if (blocker.blockedUsers.some(id => id.toString() === blockedId)) {
      return res.status(400).json({ message: "User already blocked." });
    }

    blocker.blockedUsers.push(blockedId);
    await blocker.save();

    const blocked = await User.findById(blockedId);
    if (!blocked) {
      // If the user to be blocked doesn't exist, we still proceed with blocking from the blocker's side
      // but we can't update the 'blockedBy' list of the non-existent user.
      // This is a valid scenario if a user account was deleted after being blocked.
      console.warn(`User with ID ${blockedId} not found, but blocker ${req.user.id} has blocked them.`);
      // We can still send a success message as the primary action (blocking) is done from the blocker's perspective.
      return res.json({ message: "User blocked successfully (target user not found to update their blockedBy list)." });
    }
    
    if (!blocked.blockedBy.some(id => id.toString() === req.user.id)) {
      blocked.blockedBy.push(req.user.id);
      await blocked.save();
    }

    // 🔥 Emit to both users to update UI (hiding/showing profile pics)
    if (req.app.locals.io) {
      req.app.locals.io.to(req.user.id).emit("block status updated");
      req.app.locals.io.to(blockedId).emit("block status updated");
      req.app.locals.io.to(req.user.id).emit("chat list updated");
      req.app.locals.io.to(blockedId).emit("chat list updated");
    }

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

    if (!blocker) {
      return res.status(404).json({ message: "Unblocker user not found." });
    }

    blocker.blockedUsers = blocker.blockedUsers.filter(
      (userId) => userId.toString() !== blockedId.toString()
    );
    await blocker.save();

    const blocked = await User.findById(blockedId);
    if (!blocked) {
      // Similar to blockUser, if the target user doesn't exist, we still proceed with unblocking from the blocker's side.
      console.warn(`User with ID ${blockedId} not found, but blocker ${req.user.id} has unblocked them.`);
      return res.json({ message: "User unblocked successfully (target user not found to update their blockedBy list)." });
    }
    
    blocked.blockedBy = blocked.blockedBy.filter(
      (userId) => userId.toString() !== req.user.id.toString()
    );
    await blocked.save();

    // Emit to both users
    if (req.app.locals.io) {
      req.app.locals.io.to(req.user.id).emit("block status updated");
      req.app.locals.io.to(blockedId).emit("block status updated");
      req.app.locals.io.to(req.user.id).emit("chat list updated");
      req.app.locals.io.to(blockedId).emit("chat list updated");
    }

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

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({
      iBlocked: user.blockedUsers,
      blockedMe: user.blockedBy,
    });
  } catch (err) {
    console.error("Error in getBlockedUsers:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const saveContact = async (req, res) => {
  try {
    const { phone, name } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ message: "Phone and name are required." });
    }

    let contactUser = await User.findOne({ phone: phone.trim() });

    if (!contactUser) {
      contactUser = new User({
        phone: phone.trim(),
        name,
        isVerified: false,
      });
      await contactUser.save();
    }

    const myUser = await User.findById(req.user.id);

    if (!myUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const alreadyExists = myUser.contacts.some(
      (c) => c.user.toString() === contactUser._id.toString()
    );

    if (alreadyExists) {
      return res.status(400).json({ message: "User already in contacts." });
    }

    myUser.contacts.push({
      user: contactUser._id,
      savedName: name,
    });

    await myUser.save();

    res
      .status(200)
      .json({ message: "Contact saved successfully.", contactUser });
  } catch (err) {
    console.error("Error in saveContact:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// Get Saved Contacts List
export const getSavedContacts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "contacts.user",
      "_id name phone profilePic isOnline blockedBy" // Added _id and blockedBy
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const validContacts = user.contacts
      .filter(c => c.user !== null)
      .map(c => {
        const cObj = c.toObject();
        const isBlockedByMe = req.user.blockedUsers?.includes(c.user._id);
        const isBlockedByThem = c.user.blockedBy?.includes(req.user.id);
        
        if (isBlockedByMe || isBlockedByThem) {
          cObj.user.profilePic = null;
        }
        return cObj;
      });

    res.status(200).json(validContacts);
  } catch (err) {
    console.error("Error in getSavedContacts:", err);
    res.status(500).json({ message: "Failed to fetch saved contacts." });
  }
};
