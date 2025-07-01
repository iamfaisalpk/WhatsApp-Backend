import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import  upload  from '../Middlewares/uploadMiddleware.js';
import { getMyProfile, updateMyProfile } from '../Controllers/profileController.js';

const router = express.Router();

// ✅ Apply auth middleware globally to all routes in this file
router.use(authMiddleware);

// ✅ Get user profile
router.get('/', getMyProfile);

// ✅ Update user profile with optional image
router.put('/update', upload.any(), updateMyProfile);

export default router;
