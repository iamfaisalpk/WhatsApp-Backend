import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    phone: { type: String, required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sessionId: { type: String, required: true }, 
});

const Otp = mongoose.model('Otp', otpSchema, 'otps');

export default Otp;
