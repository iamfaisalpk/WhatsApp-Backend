import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
{
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    text: {
        type: String,
        trim: true,
    },
    media: {
        url: String,
        type: { type: String, enum: ["image", "video", "audio", "file"] },
    },
    voiceNote: {
        url: String,
        duration: Number,
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
    },
    seenBy: [
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    ],
    status: {
        type: String,
        enum: ["sent", "delivered", "seen"],
        default: "sent",
    },
    deletedForEveryone: {
        type: Boolean,
        default: false,
    }

},
{ timestamps: true }
);

export default mongoose.model("Message", messageSchema);
