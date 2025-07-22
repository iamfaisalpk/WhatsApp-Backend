import express from "express";
import {
    markAsRead,
    markAsUnread,
} from "../Controllers/chatMetaController.js";
import authMiddleware from "../Middlewares/authMiddleware.js";
import { toggleFavorite } from "../Controllers/chatController.js";


const router = express.Router();

router.patch("/meta/:chatId/favorite", authMiddleware, toggleFavorite);
router.post("/mark-as-read", authMiddleware, markAsRead);
router.post("/mark-as-unread", authMiddleware, markAsUnread);

export default router;
