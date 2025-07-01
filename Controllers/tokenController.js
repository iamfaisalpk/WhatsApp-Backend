import jwt from "jsonwebtoken";
import User from "../Models/User.js";

export const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "15m" });
};

// Generate Refresh Token (7 days expiry)
export const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Refresh token missing" });
    }

    // Trim whitespace to handle potential formatting issues
    const cleanRefreshToken = refreshToken.trim();

    let decoded;
    try {
      decoded = jwt.verify(cleanRefreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (jwtError) {
      console.error("🚨 JWT verification failed:", jwtError.message);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
        error: "JWT_VERIFICATION_FAILED",
      });
    }

    const user = await User.findById(decoded.id).select("+refreshTokens");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        error: "USER_NOT_FOUND",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "User account not verified",
        error: "USER_NOT_VERIFIED",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive",
        error: "USER_INACTIVE",
      });
    }

    // 🔍 Enhanced debugging logs
    console.log("🔑 Incoming refreshToken:", cleanRefreshToken);
    console.log("🗃️ Stored tokens count:", user.refreshTokens?.length || 0);

    // Ensure refreshTokens array exists
    if (!Array.isArray(user.refreshTokens)) {
      console.warn("⚠️ refreshTokens not an array, initializing...");
      user.refreshTokens = [];
    }

    // Clean and compare tokens (handle potential whitespace issues)
    const cleanStoredTokens = user.refreshTokens.map((token) => token.trim());
    const tokenMatch = cleanStoredTokens.includes(cleanRefreshToken);

    console.log("✅ Token match found:", tokenMatch);

    if (!tokenMatch) {
      console.error("🚫 Refresh token not found in user's stored tokens");
      return res.status(401).json({
        success: false,
        message: "Refresh token not recognized",
        error: "TOKEN_NOT_RECOGNIZED",
      });
    }

    // Remove old token & issue new ones
    user.refreshTokens = user.refreshTokens.filter(
      (token) => token.trim() !== cleanRefreshToken
    );

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshTokens.push(newRefreshToken);

    try {
      await user.save();
    } catch (saveError) {
      console.error("🚨 Failed to save user:", saveError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to update user tokens",
        error: "DATABASE_SAVE_ERROR",
      });
    }

    console.log("✅ Token refresh successful for user:", user._id);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      message: "Tokens refreshed successfully",
    });
  } catch (err) {
    console.error("🚨 Refresh token failed:", err.message);
    console.error("🚨 Stack trace:", err.stack);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
      error: "REFRESH_TOKEN_ERROR",
    });
  }
};

// 🚪 Logout from Current Session
export const logoutUser = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user.id;

    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Refresh token required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Clean token before filtering
    const cleanRefreshToken = refreshToken.trim();
    user.refreshTokens = user.refreshTokens.filter(
      (token) => token.trim() !== cleanRefreshToken
    );

    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// 🚪 Logout from All Devices
export const logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.refreshTokens = [];
    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Logged out from all devices" });
  } catch (err) {
    console.error("Logout all error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// 🔧 Utility function to clean up expired refresh tokens
export const cleanupExpiredTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || !Array.isArray(user.refreshTokens)) return;

    const validTokens = [];

    for (const token of user.refreshTokens) {
      try {
        jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        validTokens.push(token);
      } catch (error) {
        console.log("🗑️ Removing expired token");
      }
    }

    if (validTokens.length !== user.refreshTokens.length) {
      user.refreshTokens = validTokens;
      await user.save();
      console.log(
        `🧹 Cleaned up ${
          user.refreshTokens.length - validTokens.length
        } expired tokens`
      );
    }
  } catch (error) {
    console.error("Token cleanup error:", error.message);
  }
};
