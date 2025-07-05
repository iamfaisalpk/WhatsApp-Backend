import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import upload from '../Middlewares/uploadMiddleware.js';
import {
    sendMessage,
    getMessages,
    markAsSeen,
    deleteChat,
    clearChatMessages,
    deleteMessage,
    deleteMessageForMe,
    reactToMessage
} from '../Controllers/messageController.js';


const router = express.Router();

router.post(
  '/',
  authMiddleware,
  upload.fields([
    { name: 'media', maxCount: 1 },
    { name: 'voiceNote', maxCount: 1 },
  ]),
  sendMessage
);

router.put('/seen', authMiddleware, markAsSeen);
router.get('/:conversationId', authMiddleware, getMessages);
router.delete('/:chatId', authMiddleware, deleteChat);
router.delete('/clear/:conversationId', authMiddleware, clearChatMessages);
router.delete("/delete-message/:messageId", authMiddleware, deleteMessage);
router.post("/delete-for-me/:messageId", authMiddleware, deleteMessageForMe);
router.post("/react/:messageId", authMiddleware, reactToMessage);


export default router;
