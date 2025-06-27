import jwt from "jsonwebtoken";
import User from "../Models/User.js";

// ✅ Generate Access Token (15 min expiry)
export const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

// ✅ Generate Refresh Token (7 days expiry)
export const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

// 🔄 Refresh Access Token
export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token missing" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isVerified || user.isActive === false) {
      return res.status(403).json({ success: false, message: "User not found or inactive" });
    }

    // 🔒 Check if refresh token exists in user DB
    if (!user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ success: false, message: "Refresh token not recognized" });
    }

    const newAccessToken = generateAccessToken(user._id);
    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });

  } catch (err) {
    console.error("Refresh token failed:", err.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
};

// 🚪 Logout from Current Session
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

    // 🔒 Remove the current refresh token from DB
    user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();

    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 🚪 Logout from All Devices
export const logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 🧹 Clear all refresh tokens
    user.refreshTokens = [];
    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();

    return res.status(200).json({ success: true, message: "Logged out from all devices" });
  } catch (err) {
    console.error("Logout all error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
