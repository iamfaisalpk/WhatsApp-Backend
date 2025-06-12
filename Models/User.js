import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    otp: String,
    name: String,
    profilePic: String,
    isVerified: { type: Boolean, default: false },
    lastLogin: Date,
}, { timestamps: true });

const User = mongoose.model('User', userSchema, 'users');

export default User;
