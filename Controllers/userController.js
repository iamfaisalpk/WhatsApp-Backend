import User from "../Models/User.js";

export const searchUsers = async (req, res) => {
    try {
    const keyword = req.query.search
    ? {
            name: { $regex: req.query.search, $options: "i" },
        }
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
