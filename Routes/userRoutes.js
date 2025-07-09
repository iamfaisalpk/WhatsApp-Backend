import express from "express";
import {
    searchUsers,
    getUserById,
    blockUser,
    unblockUser,
    getBlockedUsers
} from "../Controllers/userController.js";
import authMiddleware from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, searchUsers);
router.get("/blocked/list", authMiddleware, getBlockedUsers);
router.get("/:id", authMiddleware, getUserById);
router.put("/block/:id", authMiddleware, blockUser);      
router.put("/unblock/:id", authMiddleware, unblockUser);

export default router;
