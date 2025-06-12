import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    isGroup: { type: Boolean, default: false },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    groupName: String,
    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: {
    text: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: Date,
},
}, { timestamps: true });


const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
export default Conversation;
