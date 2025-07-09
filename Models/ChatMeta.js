import mongoose from "mongoose";

const chatMetaSchema = new mongoose.Schema(
{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    isRead: { type: Boolean, default: true },
    isFavorite: { type: Boolean, default: false },
    muted: { type: Boolean, default: false },
    lastClearedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

chatMetaSchema.index({ user: 1, chat: 1 }, { unique: true });

const ChatMeta = mongoose.model("ChatMeta", chatMetaSchema);
export default ChatMeta;
