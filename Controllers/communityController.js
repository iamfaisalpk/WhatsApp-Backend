import Conversation from "../Models/Conversation.js";

export const createCommunity = async (req, res) => {
    const { groupName, groupAvatar, description } = req.body;

    if (!groupName) {
        return res.status(400).json({ success: false, message: "Community name is required" });
    }

    try {
        const community = await Conversation.create({
            isGroup: true,
            isCommunity: true,
            groupName,
            groupAvatar: groupAvatar || "", 
            description: description || "",
            members: [req.user.id],
            groupAdmin: req.user.id,
        });

        const fullCommunity = await Conversation.findById(community._id)
            .populate("members", "-otp -__v")
            .populate("groupAdmin", "-otp -__v");

        return res.status(201).json({ success: true, community: fullCommunity });
    } catch (error) {
        console.error("Create Community Error:", error);
        return res.status(500).json({ success: false, message: "Failed to create community" });
    }
};


export const addToCommunity = async (req, res) => {
    const { communityId, userId } = req.body;

    try {
        const updatedCommunity = await Conversation.findByIdAndUpdate(
            communityId,
            { $addToSet: { members: userId } },
            { new: true }
        )
            .populate("members", "-otp -__v")
            .populate("groupAdmin", "-otp -__v");

        return res.status(200).json({ success: true, updatedCommunity });
    } catch (error) {
        console.error("Add to Community Error:", error);
        return res.status(500).json({ success: false, message: "Failed to add member" });
    }
};


export const removeFromCommunity = async (req, res) => {
    const { communityId, userId } = req.body;

    try {
        const updatedCommunity = await Conversation.findByIdAndUpdate(
            communityId,
            { $pull: { members: userId } },
            { new: true }
        )
            .populate("members", "-otp -__v")
            .populate("groupAdmin", "-otp -__v");

        return res.status(200).json({ success: true, updatedCommunity });
    } catch (error) {
        console.error("Remove from Community Error:", error);
        return res.status(500).json({ success: false, message: "Failed to remove member" });
    }
};


export const fetchMyCommunities = async (req, res) => {
    try {
        const communities = await Conversation.find({
            isCommunity: true,
            members: req.user.id
        })
            .populate("members", "-otp -__v")
            .populate("groupAdmin", "-otp -__v")
            .sort({ updatedAt: -1 });

        return res.status(200).json({ success: true, communities });
    } catch (error) {
        console.error("Fetch Communities Error:", error);
        return res.status(500).json({ success: false, message: "Unable to fetch communities" });
    }
};
