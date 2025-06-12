import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import { accessChat, fetchChats } from '../Controllers/chatController.js';

const router = express.Router();

router.post('/', authMiddleware, accessChat);

router.get('/', authMiddleware, fetchChats);

export default router;
