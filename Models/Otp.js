import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    phone: { type: String, required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sessionId: { type: String, required: true }, 
});

// Optimization: Index for faster verification lookups
otpSchema.index({ phone: 1, sessionId: 1 });

// Optimization: TTL index to automatically delete expired OTPs from the database
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model('Otp', otpSchema, 'otps');

export default Otp;
