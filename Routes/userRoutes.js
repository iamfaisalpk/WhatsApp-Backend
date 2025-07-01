import express from "express";
import { searchUsers, getUserById } from "../Controllers/userController.js";
import authMiddleware from "../Middlewares/authMiddleware.js";

const router = express.Router();


router.get("/", authMiddleware, searchUsers);
router.get("/:id", authMiddleware, getUserById);

export default router;
