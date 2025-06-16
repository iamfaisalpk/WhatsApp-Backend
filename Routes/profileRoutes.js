import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import upload from '../Middlewares/uploadMiddleware.js';
import {
    getMyProfile,
    updateMyProfile,
} from '../Controllers/profileController.js';

const router = express.Router();

// Get current user profile
router.get('/me', authMiddleware, getMyProfile);

// Update profile with optional image upload
router.put(
    '/update',
    authMiddleware,
    upload.single('profilePic'),
    updateMyProfile
);

export default router;
