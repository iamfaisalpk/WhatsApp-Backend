import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import upload from '../Middlewares/uploadMiddleware.js';
import {
    getMyProfile,
    updateMyProfile,
} from '../Controllers/profileController.js';

const router = express.Router();

router.get('/me', authMiddleware, getMyProfile);

router.put('/update', authMiddleware, upload.single('profilePic'), updateMyProfile);

export default router;
