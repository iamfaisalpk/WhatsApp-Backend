import dotenv from 'dotenv';
dotenv.config();
import client from '../config/twilioClient.js';
import User from '../Models/User.js';
import Otp from '../Models/Otp.js';
import { getAllOtps, clearAllOtps } from '../Utils/devUtils.js';

const TEST_NUMBERS = ['+15005550006', '+15005550001', '+917994010513'];

// Helper to generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP
export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 

    // Save to MongoDB
    await Otp.findOneAndUpdate(
      { phone: formattedPhone },
      { code: otp, expiresAt, attempts: 0 },
      { upsert: true, new: true }
    );

    if (process.env.NODE_ENV === 'development' && formattedPhone !== '+917994010513') {
      return res.status(200).json({
        success: true,
        message: 'Development mode: OTP generated',
        phone: formattedPhone,
        otp,
        developmentMode: true
      });
    }

    if (!process.env.TWILIO_PHONE_NUMBER) {
      return res.status(500).json({
        success: false,
        message: 'Twilio phone number missing'
      });
    }

    try {
      const message = await client.messages.create({
        body: `Your WhatsApp verification code is: ${otp}. It will expire in 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });

      res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        phone: formattedPhone,
        messageId: message.sid
      });
    } catch (twilioError) {
      if (process.env.NODE_ENV === 'development') {
        return res.status(200).json({
          success: true,
          message: 'OTP generated (SMS failed)',
          phone: formattedPhone,
          otp,
          developmentMode: true,
          error: 'SMS service unavailable'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP',
        details: twilioError.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      details: error.message
    });
  }
};

// Verify OTP
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required'
      });
    }

    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    const otpEntry = await Otp.findOne({ phone: formattedPhone });
    if (!otpEntry) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired'
      });
    }

    if (new Date() > otpEntry.expiresAt) {
      await Otp.deleteOne({ phone: formattedPhone });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    if (otpEntry.attempts >= 3) {
      await Otp.deleteOne({ phone: formattedPhone });
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts'
      });
    }

    if (otpEntry.code !== otp.trim()) {
      otpEntry.attempts += 1;
      await otpEntry.save();
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
        attemptsRemaining: 3 - otpEntry.attempts
      });
    }

    // OTP verified
    await Otp.deleteOne({ phone: formattedPhone });

    let user = await User.findOne({ phone: formattedPhone });
    if (!user) {
      user = new User({
        phone: formattedPhone,
        isVerified: true,
        lastLogin: new Date()
      });
    } else {
      user.isVerified = true;
      user.lastLogin = new Date();
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      phone: formattedPhone,
      user: { id: user._id, phone: user.phone, isVerified: user.isVerified }
    });
  } catch (error) {
    console.error('verifyOtp error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      details: error.message
    });
  }
};

// OTP status (for debugging/dev)
export const getOtpStatus = async (req, res) => {
  const { phone } = req.query;
  let formattedPhone = phone?.trim();
  if (formattedPhone && !formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  const otpEntry = await Otp.findOne({ phone: formattedPhone });
  if (!otpEntry) {
    return res.json({ status: 'not_found' });
  }

  const isExpired = new Date() > otpEntry.expiresAt;
  res.json({
    status: isExpired ? 'expired' : 'active',
    attempts: otpEntry.attempts,
    expiresIn: Math.max(0, otpEntry.expiresAt - Date.now()),
    ...(process.env.NODE_ENV === 'development' && { otp: otpEntry.code, developmentMode: true })
  });
};

export const getDevelopmentStatus = (req, res) => {
  res.json({
    developmentMode: process.env.NODE_ENV === 'development',
    environment: process.env.NODE_ENV || 'production',
    testNumbers: process.env.NODE_ENV === 'development' ? TEST_NUMBERS : 'Hidden',
    message: process.env.NODE_ENV === 'development'
      ? 'Development mode active - OTPs will be shown directly'
      : 'Production mode - All OTPs sent via SMS',
    timestamp: new Date().toISOString()
  });
};

// Dev endpoints reuse
export { getAllOtps, clearAllOtps };
