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

// Update User Profile
export const updateMyProfile = async (req, res) => {
  try {
    console.log("Profile update request for user:", req.user.id);
    
    // 1. First verify the user exists
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error("User not found:", req.user.id);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 2. Validate input
    const { name } = req.body;
    const profilePic = req.file?.path;
    
    if (!name && !profilePic) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update",
      });
    }

    // 3. Prepare updates
    const updates = {};
    if (name) updates.name = name.trim();
    if (profilePic) updates.profilePic = profilePic;

    // 4. Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select("-__v -otp");

    if (!updatedUser) {
      throw new Error("User update failed");
    }

    res.status(200).json({
      success: true,
      message: "Profile updated",
      user: updatedUser,
    });

  } catch (error) {
    console.error("Profile update error:", error);
    
    // Handle specific errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        error: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};