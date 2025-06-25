import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import upload from '../Middlewares/uploadMiddleware.js';
import {
    sendMessage,
    getMessages,
    markAsSeen,
    deleteChat,
    clearChatMessages
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

export default router;
