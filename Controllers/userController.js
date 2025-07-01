import User from "../Models/User.js";

// Search users by name (except current user)
export const searchUsers = async (req, res) => {
try {
    const keyword = req.query.search
        ? { name: { $regex: req.query.search, $options: "i" } }
        : {};

    const users = await User.find(keyword).find({
        _id: { $ne: req.user._id },
    });

    res.json(users);
} catch (error) {
    console.error("User search error:", error);
    res.status(500).json({ message: "Server error" });
}
};

//  Get user by ID (for chat header)
export const getUserById = async (req, res) => {
try {
    const userId = req.params.id;
    const user = await User.findById(userId).select("name profilePic isOnline lastSeen");

    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json(user);
} catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({ success: false, message: "Server error" });
}
};
