import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import upload from '../Middlewares/uploadMiddleware.js';
import {
    sendMessage,
    getMessages,
    markAsSeen,
} from '../Controllers/messageController.js';

const router = express.Router();

router.post('/', authMiddleware, upload.single('media'), sendMessage);

router.get('/:conversationId', authMiddleware, getMessages);
router.put('/seen', authMiddleware, markAsSeen);

export default router;
