import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
    isGroupChat: { type: Boolean, default: false },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    latestMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    groupName: String,
    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;
