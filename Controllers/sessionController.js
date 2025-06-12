import crypto from "crypto";
import Session from "../Models/Session.js";
import twilio from 'twilio';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


export const createSession = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: "Phone number required" });
    }

    const sessionId = crypto.randomBytes(16).toString("hex");
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    
    await twilioClient.messages.create({
      body: `Your WhatsApp OTP is ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    const session = new Session({ sessionId, phone, otp });
    await session.save();

    res.json({ sessionId });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({ message: "Server error creating session" });
  }
};

export const verifySession = async (req, res) => {
  const { sessionId, phone, otp } = req.body;
  const io = req.app.locals.io;

  if (!sessionId || !phone || !otp) {
    return res.status(400).json({ message: "SessionId, phone, and OTP required" });
  }

  try {
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.status === "verified") {
      return res.status(400).json({ message: "Session already verified" });
    }

    if (session.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    session.phone = phone;
    session.status = "verified";
    await session.save();

    io.to(sessionId).emit("sessionVerified", { phone });

    res.json({ message: "Session verified successfully" });
  } catch (error) {
    console.error("Verify session error:", error);
    res.status(500).json({ message: "Server error verifying session" });
  }
};