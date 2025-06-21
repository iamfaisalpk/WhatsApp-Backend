import dotenv from 'dotenv';
dotenv.config();

import client from '../config/twilioClient.js';
import User from '../Models/User.js';
import Otp from '../Models/Otp.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getAllOtps, clearAllOtps } from '../Utils/devUtils.js';

const TEST_NUMBERS = ['+15005550006', '+15005550001', '+917994010513'];

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const formatPhoneNumber = (rawPhone) => {
  let phone = rawPhone.trim();

  if (phone.startsWith('+91') && phone.length === 13) {
    return phone;
  }

  phone = phone.replace(/^in/, '').replace(/\D/g, '');

  if (!phone.startsWith('91')) {
    phone = '91' + phone;
  }

  return '+' + phone;
};

// Send OTP
export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const formattedPhone = formatPhoneNumber(phone);
    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const sessionId = uuidv4();

    // Delete existing OTPs for the same phone number
    await Otp.deleteMany({ phone: formattedPhone });

    //  Save new OTP
    const newOtp = new Otp({
      phone: formattedPhone,
      code: hashedOtp,
      expiresAt,
      sessionId,
    });

    await newOtp.save();
    console.log(" OTP saved to DB:", formattedPhone, sessionId);

    //  Dev/test mode: return OTP
    if (process.env.NODE_ENV === 'development' || TEST_NUMBERS.includes(formattedPhone)) {
      return res.status(200).json({
        success: true,
        message: 'OTP generated (development mode)',
        phone: formattedPhone,
        otp,
        sessionId,
        developmentMode: true,
      });
    }

    // Production: send via Twilio
    const message = await client.messages.create({
      body: `Your WhatsApp verification code is: ${otp}. It will expire in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      phone: formattedPhone,
      messageId: message.sid,
      sessionId,
    });

  } catch (error) {
    console.error(' [SEND OTP] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// Verify OTP
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp, sessionId } = req.body;

    // Step 1: Validate inputs
    if (!phone || !otp || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Phone, OTP, and sessionId are required",
      });
    }

    // Step 2: Format phone
    const formattedPhone = formatPhoneNumber(phone);
    console.log("🔍 Verifying OTP for:", formattedPhone, "Session:", sessionId);

    //  Step 3: Find OTP using both phone and sessionId
    const otpEntry = await Otp.findOne({ phone: formattedPhone, sessionId });

    if (!otpEntry) {
      return res.status(400).json({
        success: false,
        message: "OTP not found or expired",
      });
    }

    // Step 4: Check expiry
    if (new Date() > otpEntry.expiresAt) {
      await Otp.deleteOne({ phone: formattedPhone, sessionId });
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    // Step 5: Check attempts
    if (otpEntry.attempts >= 3) {
      await Otp.deleteOne({ phone: formattedPhone, sessionId });
      return res.status(400).json({
        success: false,
        message: "Too many attempts",
      });
    }

    // Step 6: Compare OTP
    const isMatch = await bcrypt.compare(otp.toString().trim(), otpEntry.code);
    if (!isMatch) {
      otpEntry.attempts += 1;
      await otpEntry.save();
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        attemptsRemaining: 3 - otpEntry.attempts,
      });
    }

    // Step 7: OTP matched - delete it
    await Otp.deleteOne({ phone: formattedPhone, sessionId });

    // Step 8: Create or update user
    let user = await User.findOne({ phone: formattedPhone });

    if (!user) {
      user = await User.create({
        phone: formattedPhone,
        isVerified: true,
        lastLogin: new Date(),
        isOnline: true,
      });
      console.log(" New user created:", user._id.toString());
    } else {
      user.isVerified = true;
      user.lastLogin = new Date();
      user.isOnline = true;
      await user.save();
      console.log("Existing user updated:", user._id.toString());
    }

    // Step 9: Generate token
    const token = jwt.sign(
      { id: user._id.toString(), phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Step 10: Respond
    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      sessionId,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        about: user.about,
        profilePic: user.profilePic,
        isVerified: user.isVerified,
        isOnline: user.isOnline,
        lastLogin: user.lastLogin,
      },
      token,
    });

  } catch (error) {
    console.error("[VERIFY OTP] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



//  Development-only
export const getOtpStatus = async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.json({ status: 'phone_required' });

  const formattedPhone = formatPhoneNumber(phone);

  const otpEntry = await Otp.findOne({ phone: formattedPhone });
  if (!otpEntry) return res.json({ status: 'not_found' });

  const isExpired = new Date() > otpEntry.expiresAt;
  return res.json({
    status: isExpired ? 'expired' : 'active',
    attempts: otpEntry.attempts,
    expiresIn: Math.max(0, otpEntry.expiresAt - Date.now()),
    ...(process.env.NODE_ENV === 'development' && {
      otp: otpEntry.code,
      developmentMode: true
    })
  });
};

export const getDevelopmentStatus = (req, res) => {
  res.json({
    developmentMode: process.env.NODE_ENV === 'development',
    environment: process.env.NODE_ENV || 'production',
    testNumbers: process.env.NODE_ENV === 'development' ? TEST_NUMBERS : 'Hidden',
    message: process.env.NODE_ENV === 'development'
      ? 'Development mode active - OTPs shown directly'
      : 'Production mode - OTPs sent via SMS',
    timestamp: new Date().toISOString()
  });
};

// Debug utils
export { getAllOtps, clearAllOtps };
