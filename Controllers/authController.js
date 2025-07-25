import dotenv from "dotenv";
dotenv.config();

import client from "../config/twilioClient.js";
import User from "../Models/User.js";
import Otp from "../Models/Otp.js";
import bcrypt from "bcryptjs";
import { generateTokens } from "../Utils/jwtUtils.js";
import { v4 as uuidv4 } from "uuid";

const TEST_NUMBERS = ["+15005550006", "+917994010513"];

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const formatPhoneNumber = (rawPhone) => {
  let phone = rawPhone.trim();
  if (phone.startsWith("+91") && phone.length === 13) return phone;
  phone = phone.replace(/^in/, "").replace(/\D/g, "");
  if (!phone.startsWith("91")) phone = "91" + phone;
  return "+" + phone;
};

//  SEND OTP
export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone)
      return res
        .status(400)
        .json({ success: false, message: "Phone is required" });

    const formattedPhone = formatPhoneNumber(phone);
    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const sessionId = uuidv4();

    await Otp.deleteMany({ phone: formattedPhone });

    const newOtp = new Otp({
      phone: formattedPhone,
      code: hashedOtp,
      expiresAt,
      sessionId,
    });
    await newOtp.save();

    if (
      process.env.NODE_ENV === "development" ||
      TEST_NUMBERS.includes(formattedPhone)
    ) {
      return res.status(200).json({
        success: true,
        message: "OTP (dev mode)",
        phone: formattedPhone,
        otp,
        sessionId,
      });
    }

    await client.messages.create({
      body: `Your WhatsApp code is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent",
      phone: formattedPhone,
      sessionId,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "OTP send failed", error: err.message });
  }
};

// VERIFY OTP
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp, sessionId } = req.body;
    if (!phone || !otp || !sessionId) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const formattedPhone = formatPhoneNumber(phone);

    const otpEntry = await Otp.findOne({ phone: formattedPhone, sessionId });
    if (!otpEntry) {
      return res
        .status(400)
        .json({ success: false, message: "OTP not found or expired" });
    }

    if (new Date() > otpEntry.expiresAt) {
      await Otp.deleteOne({ phone: formattedPhone, sessionId });
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    if (otpEntry.attempts >= 3) {
      await Otp.deleteOne({ phone: formattedPhone, sessionId });
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. OTP expired.",
      });
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(otp.trim(), otpEntry.code);
    } catch (compareError) {
      console.error("OTP comparison failed:", compareError.message);
    }

    if (!isMatch) {
      otpEntry.attempts += 1;
      await otpEntry.save();
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        attemptsRemaining: 3 - otpEntry.attempts,
      });
    }

    await Otp.deleteOne({ phone: formattedPhone, sessionId });

    let user = await User.findOne({ phone: formattedPhone });
    let isNewUser = false;

    if (!user) {
      user = await User.create({
        phone: formattedPhone,
        isVerified: true,
        isOnline: true,
        lastLogin: new Date(),
        refreshTokens: [],
      });
      isNewUser = true;
    } else {
      user.isVerified = true;
      user.isOnline = true;
      user.lastLogin = new Date();
    }

    //  Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);
    const cleanRefreshToken = refreshToken.trim();
    const existingTokens = (user.refreshTokens || []).map((t) => t.trim());
    const updatedTokens = [
      ...new Set([...existingTokens, cleanRefreshToken]),
    ].slice(-10);

    user.refreshTokens = updatedTokens;
    await user.save();

    //  Auto-create one-to-one chats with existing users if new
    if (isNewUser) {
      const allUsers = await User.find({ _id: { $ne: user._id } });

      for (const otherUser of allUsers) {
        const existingChat = await Conversation.findOne({
          isGroup: false,
          members: { $all: [user._id, otherUser._id] },
        });

        if (!existingChat) {
          await Conversation.create({
            isGroup: false,
            members: [user._id, otherUser._id],
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      sessionId,
      accessToken,
      refreshToken: cleanRefreshToken,
      user: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        profilePic: user.profilePic,
        isVerified: user.isVerified,
        isOnline: user.isOnline,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error("[VERIFY OTP] Error:", error);
    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
      error: error.message,
    });
  }
};

//  DEV TOOL: OTP Status
export const getOtpStatus = async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.json({ status: "phone_required" });

  const formattedPhone = formatPhoneNumber(phone);
  const otpEntry = await Otp.findOne({ phone: formattedPhone });
  if (!otpEntry) return res.json({ status: "not_found" });

  const isExpired = new Date() > otpEntry.expiresAt;
  return res.json({
    status: isExpired ? "expired" : "active",
    attempts: otpEntry.attempts,
    expiresIn: Math.max(0, otpEntry.expiresAt - Date.now()),
    ...(process.env.NODE_ENV === "development" && {
      otp: otpEntry.code,
      developmentMode: true,
    }),
  });
};

//  DEV TOOL: Environment Info
export const getDevelopmentStatus = (req, res) => {
  res.json({
    developmentMode: process.env.NODE_ENV === "development",
    environment: process.env.NODE_ENV || "production",
    testNumbers:
      process.env.NODE_ENV === "development" ? TEST_NUMBERS : "Hidden",
    message:
      process.env.NODE_ENV === "development"
        ? "Development mode active - OTPs shown directly"
        : "Production mode - OTPs sent via SMS",
    timestamp: new Date().toISOString(),
  });
};

//  DEV TOOL: View All OTPs
export const getAllOtps = async (req, res) => {
  const otps = await Otp.find({});
  res.json({ total: otps.length, otps });
};

//  DEV TOOL: Clear All OTPs
export const clearAllOtps = async (req, res) => {
  await Otp.deleteMany({});
  res.json({ message: "All OTPs deleted" });
};
