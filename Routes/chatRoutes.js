import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import {
    accessChat,
    fetchChats,
    createGroupChat,
    renameGroup,
    addToGroup,
    removeFromGroup
} from '../Controllers/chatController.js';
import { groupAvatarUpload } from '../Utils/multerSetup.js'; 

const router = express.Router();

router.post('/', authMiddleware, accessChat);
router.get('/', authMiddleware, fetchChats);


router.post('/group', authMiddleware, groupAvatarUpload.single('groupAvatar'), createGroupChat);

router.put('/rename', authMiddleware, renameGroup);
router.put('/group-add', authMiddleware, addToGroup);
router.put('/group-remove', authMiddleware, removeFromGroup);

export default router;
