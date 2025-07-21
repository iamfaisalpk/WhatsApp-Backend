import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import  upload  from '../Middlewares/uploadMiddleware.js';
import { getMyProfile, updateMyProfile } from '../Controllers/profileController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getMyProfile);

router.put('/update', upload.any(), updateMyProfile);

export default router;
