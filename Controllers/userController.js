import User from "../Models/User.js";

export const searchUsers = async (req, res) => {
  try {
    const search = req.query.search;
    console.log("🔍 Search Query:", search);

    if (!search) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const keyword = {
      $or: [
        { phone: { $regex: search, $options: "i" } },
      ],
    };

    const users = await User.find(keyword).find({ _id: { $ne: req.user._id } });

    if (users.length === 0) {
      console.log("🟥 No users found");
      return res.status(404).json({ message: "No users found" });
    }

    console.log("✅ Users found:", users.length);
    res.json(users);
  } catch (err) {
    console.error("❌ Error in searchUsers:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("❌ Error in getUserById:", err);
    res.status(500).json({ message: "Server error" });
  }
};
