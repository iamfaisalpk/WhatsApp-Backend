import express from "express";
import { searchUsers } from "../Controllers/userController.js";
import authMiddleware from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, searchUsers);

export default router;