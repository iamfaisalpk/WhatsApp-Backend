import mongoose from "mongoose";
import crypto from "crypto";

const conversationSchema = new mongoose.Schema(
  {
    isGroup: { type: Boolean, default: false },
    isCommunity: { type: Boolean, default: false },

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    groupName: { type: String, trim: true, default: "" },
    groupAvatar: { type: String, default: "" },

    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    groupDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    groupDescriptionLastUpdated: {
      type: Date,
    },
    groupDescriptionUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    lastMessage: {
      text: { type: String, default: "" },
      media: { type: String, default: "" },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date, default: null },
    },

    isFavorite: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    unreadBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isDeleted: { type: Boolean, default: false },

    inviteToken: {
      type: String,
      unique: true,
      required: true,
      default: () => crypto.randomUUID(),
    },
    inviteCreatedAt: {
      type: Date,
      default: Date.now,
    },
    inviteExpiresAt: {
      type: Date,
      default: () => Date.now() + 1000 * 60 * 60 * 24 * 7, 
    },
  },
  { timestamps: true }
);

// Indexes for performance
conversationSchema.index({ members: 1 });
conversationSchema.index({ groupAdmin: 1 });
conversationSchema.index({ "lastMessage.timestamp": -1 });
conversationSchema.index({ inviteToken: 1 }, { unique: true });

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

export default Conversation;
