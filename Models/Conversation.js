import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
{
    isGroup: { type: Boolean, default: false },
    isCommunity: { type: Boolean, default: false },

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    groupName: { type: String, default: "" },
    groupAvatar: { type: String, default: "" },
    description: { type: String, default: "" },

    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    lastMessage: {
        text: { type: String, default: "" },
        media: { type: String, default: "" },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        timestamp: { type: Date, default: null },
    },

    isFavorite: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    unreadBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    //  New fields
    hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// Optional performance indexes
conversationSchema.index({ members: 1 });
conversationSchema.index({ groupAdmin: 1 });
conversationSchema.index({ "lastMessage.timestamp": -1 });

const Conversation =
    mongoose.models.Conversation ||
    mongoose.model("Conversation", conversationSchema);

export default Conversation;
