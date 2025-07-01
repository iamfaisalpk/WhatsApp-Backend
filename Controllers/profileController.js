import User from "../Models/User.js";
import { profileUpdateSchema } from "../validators/profileValidator.js";

//  Get Logged-In User Profile
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-__v -otp -otpExpiry");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(" Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error",
    });
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    console.log("📥 Profile update request for user:", req.user.id);

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { name, about } = req.body;
    let profilePic;

    // 👇 Find file if it exists
    if (req.files && req.files.length > 0) {
      const picFile = req.files.find((file) => file.fieldname === "profilePic");
      if (picFile) {
        profilePic = picFile.path;
      }
    }

    if (!name && !about && !profilePic) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (about) updates.about = about.trim();
    if (profilePic) updates.profilePic = profilePic;

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select("-__v -otp");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(" Profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
