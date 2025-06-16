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

router.put('/seen', authMiddleware, markAsSeen);
router.get('/:conversationId', authMiddleware, getMessages);


export default router;
