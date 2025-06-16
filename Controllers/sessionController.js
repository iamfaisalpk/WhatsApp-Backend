import crypto from "crypto";
import Session from "../Models/Session.js";
import twilio from 'twilio';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


const formatPhone = (phone) => {
  let formatted = phone.trim();
  if (!formatted.startsWith('+')) {
    formatted = '+91' + formatted; 
  }
  return formatted;
};

export const createSession = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: "Phone number required" });
    }

    const formattedPhone = formatPhone(phone);
    const sessionId = crypto.randomBytes(16).toString("hex");
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Try sending OTP via Twilio
    try {
      await twilioClient.messages.create({
        body: `Your WhatsApp OTP is ${otp}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone,
      });
    } catch (twilioError) {
      return res.status(500).json({
        message: "Failed to send OTP",
        error: twilioError.message,
      });
    }

    // Save session
    const session = new Session({
      sessionId,
      phone: formattedPhone,
      otp,
    });

    await session.save();

    res.status(200).json({ sessionId });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({ message: "Server error creating session" });
  }
};

export const verifySession = async (req, res) => {
  const { sessionId, phone, otp } = req.body;
  const io = req.app?.locals?.io; // optional Socket.io

  if (!sessionId || !phone || !otp) {
    return res.status(400).json({ message: "SessionId, phone, and OTP required" });
  }

  try {
    const formattedPhone = formatPhone(phone);
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.status === "verified") {
      return res.status(400).json({ message: "Session already verified" });
    }

    // Brute force protection
    if (session.attempts >= 3) {
      return res.status(429).json({ message: "Too many attempts. Session locked." });
    }

    // Wrong OTP
    if (session.otp !== otp.trim()) {
      session.attempts += 1;
      await session.save();
      return res.status(400).json({
        message: "Invalid OTP",
        attemptsRemaining: 3 - session.attempts,
      });
    }

    // Success
    session.phone = formattedPhone;
    session.status = "verified";
    await session.save();

    if (io) {
      io.to(sessionId).emit("sessionVerified", { phone: formattedPhone });
    }

    res.status(200).json({ message: "Session verified successfully", phone: formattedPhone });
  } catch (error) {
    console.error("Verify session error:", error);
    res.status(500).json({ message: "Server error verifying session" });
  }
};
