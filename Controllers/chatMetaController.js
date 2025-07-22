import ChatMeta from "../Models/ChatMeta.js";


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
    res
      .status(500)
      .json({ success: false, message: "Unable to mark as unread" });
  }
};
