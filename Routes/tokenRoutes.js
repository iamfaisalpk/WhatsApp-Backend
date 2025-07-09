import express from "express";
import {
    refreshAccessToken,
    logoutUser,
    logoutAllDevices,
} from "../Controllers/tokenController.js";
import authMiddleware from "../Middlewares/authMiddleware.js";

const router = express.Router();

//  Refresh token (get new access token using valid refresh token)
router.post("/refresh", refreshAccessToken);

//  Logout from current device (access token must be valid)
router.post("/logout", authMiddleware, logoutUser);

//  Logout from all devices
router.post("/logout-all", authMiddleware, logoutAllDevices);

export default router;
