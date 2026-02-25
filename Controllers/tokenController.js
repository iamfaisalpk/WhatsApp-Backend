import { generateTokens, verifyRefreshToken } from "../Utils/jwtUtils.js";
import User from "../Models/User.js";

export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token missing" });
    }

    const cleanRefreshToken = refreshToken.trim();
    let decoded;
    
    try {
      decoded = verifyRefreshToken(cleanRefreshToken);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
        error: "JWT_VERIFICATION_FAILED",
      });
    }

    const user = await User.findById(decoded.id).select("+refreshTokens");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.refreshTokens || !user.refreshTokens.includes(cleanRefreshToken)) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not recognized",
        error: "TOKEN_NOT_RECOGNIZED",
      });
    }

    // Generate new pair
    const tokens = generateTokens(user._id);

    // Replace old token with new one
    user.refreshTokens = user.refreshTokens.filter(t => t !== cleanRefreshToken);
    user.refreshTokens.push(tokens.refreshToken);
    
    // Keep max 5 tokens
    if (user.refreshTokens.length > 5) {
      user.refreshTokens.shift();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        profilePic: user.profilePic
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error during token refresh" });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user.id;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const cleanRefreshToken = refreshToken.trim();
    user.refreshTokens = user.refreshTokens.filter((token) => token.trim() !== cleanRefreshToken);

    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();

    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.refreshTokens = [];
    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();

    return res.status(200).json({ success: true, message: "Logged out from all devices" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

//  Utility function to clean up expired refresh tokens
export const cleanupExpiredTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || !Array.isArray(user.refreshTokens)) return;

    const validTokens = [];

    for (const token of user.refreshTokens) {
      try {
        verifyRefreshToken(token);
        validTokens.push(token);
      } catch (error) {
        // Token expired or invalid
      }
    }

    if (validTokens.length !== user.refreshTokens.length) {
      user.refreshTokens = validTokens;
      await user.save();
    }
  } catch (error) {
    console.error("Token cleanup error:", error.message);
  }
};

