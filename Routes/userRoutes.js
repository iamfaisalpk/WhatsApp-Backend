import express from "express";
import {
    searchUsers,
    getUserById,
    blockUser,
    unblockUser,
    getBlockedUsers,
    saveContact,
    getSavedContacts
} from "../Controllers/userController.js";
import authMiddleware from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, searchUsers);
router.get("/blocked/list", authMiddleware, getBlockedUsers);
router.get("/:id", authMiddleware, getUserById);
router.put("/block/:id", authMiddleware, blockUser);      
router.put("/unblock/:id", authMiddleware, unblockUser);
router.post("/save-contact", authMiddleware, saveContact);
router.get("/contacts/list", authMiddleware, getSavedContacts);



export default router;
