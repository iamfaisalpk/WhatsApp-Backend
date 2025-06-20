// import express from 'express';
// import authMiddleware from '../Middlewares/authMiddleware.js';
// import upload from '../Middlewares/uploadMiddleware.js';
// import {
//     getMyProfile,
//     updateMyProfile,
// } from '../Controllers/profileController.js';

// const router = express.Router();

// // Get current user profile
// router.get('/me', authMiddleware, getMyProfile);

// // Update profile (name and/or image)
// router.put(
//     '/update',
//     authMiddleware,
//     upload.single('profilePic'),
//     updateMyProfile
// );

// export default router;

// Routes/profileRoutes.js
import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import { uploadSingle } from '../Middlewares/uploadMiddleware.js';
import { getMyProfile, updateMyProfile } from '../Controllers/profileController.js';

const router = express.Router();

router.use(authMiddleware)

// Get user profile
router.get('/', authMiddleware, getMyProfile);

// Update user profile - THIS IS THE MISSING ROUTE
router.put('/update', authMiddleware, uploadSingle('profilePic'), updateMyProfile);

export default router;