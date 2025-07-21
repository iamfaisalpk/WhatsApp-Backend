import ChatMeta from "../Models/ChatMeta.js";

//  Toggle favorite status
export const toggleFavorite = async (req, res) => {
  const { chatId } = req.body;

  try {
    const meta = await ChatMeta.findOne({ user: req.user.id, chat: chatId });

    if (meta) {
      meta.isFavorite = !meta.isFavorite;
      await meta.save();
    } else {
      await ChatMeta.create({
        user: req.user.id,
        chat: chatId,
        isFavorite: false,
      });
    }

    res.status(200).json({ success: true, message: "Favorite toggled" });
  } catch (error) {
    console.error("Toggle Favorite Error:", error);
    res.status(500).json({ success: false, message: "Unable to toggle favorite" });
  }
};

//  Mark as read
export const markAsRead = async (req, res) => {
  const { chatId } = req.body;

  try {
    await ChatMeta.findOneAndUpdate(
      { user: req.user.id, chat: chatId },
      { isRead: true },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: "Marked as read" });
  } catch (error) {
    console.error("Mark as Read Error:", error);
    res.status(500).json({ success: false, message: "Unable to mark as read" });
  }
};

//  Mark as unread
export const markAsUnread = async (req, res) => {
  const { chatId } = req.body;

  try {
    await ChatMeta.findOneAndUpdate(
      { user: req.user.id, chat: chatId },
      { isRead: false },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: "Marked as unread" });
  } catch (error) {
    console.error("Mark as Unread Error:", error);
    res.status(500).json({ success: false, message: "Unable to mark as unread" });
  }
};
