import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    otp: String,
    name: { type: String, default: '' },
    about: { type: String, default: 'Hey there! I am using WhatsApp Clone.' },
    profilePic: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    lastLogin: Date,
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },
}, { timestamps: true });

const User = mongoose.model('User', userSchema, 'users');

export default User;
