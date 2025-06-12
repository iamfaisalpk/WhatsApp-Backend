import express from "express";
import { createSession, verifySession } from "../Controllers/sessionController.js";


const router = express.Router();

router.post("/create-session", createSession);
router.post("/verify-session", verifySession);

export default router;
