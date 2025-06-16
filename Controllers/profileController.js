import User from "../Models/User.js";
import { profileUpdateSchema } from "../validators/profileValidator.js";

// 🧾 Get Logged-In User Profile
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-__v -otp");

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
    console.error("❌ Get profile error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Update User Profile
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - no user ID in token",
      });
    }

    const { name } = req.body;
    const profilePic = req.file?.path || req.file?.url;

    if (!name && !profilePic) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update. Please send name or profile picture.",
      });
    }

    if (name) {
      const { error } = profileUpdateSchema.validate({ name });
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details[0].message,
        });
      }
    }

    const updatedData = {};
    if (name?.trim()) updatedData.name = name.trim();
    if (profilePic) updatedData.profilePic = profilePic; 

    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
      new: true,
    }).select("-otp -__v");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found during update",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile update failed:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};




