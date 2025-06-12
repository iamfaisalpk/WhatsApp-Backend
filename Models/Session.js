import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    phone: { type: String, default: null }, 
    otp: { type: String, default: null }, 
    status: { type: String, enum: ["pending", "verified"], default: "pending" },
    createdAt: { type: Date, default: Date.now, expires: 600 }, 
});

const Session = mongoose.model("Session", sessionSchema);
export default Session;