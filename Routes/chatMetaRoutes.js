import express from "express";
import {
    toggleFavorite,
    markAsRead,
    markAsUnread,
} from "../Controllers/chatMetaController.js";
import authMiddleware from "../Middlewares/authMiddleware.js";


const router = express.Router();

router.post("/toggle-favorite", authMiddleware, toggleFavorite);
router.post("/mark-as-read", authMiddleware, markAsRead);
router.post("/mark-as-unread", authMiddleware, markAsUnread);

export default router;
