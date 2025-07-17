import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import {
    accessChat,
    fetchChats,
    createGroupChat,
    renameGroup,
    addToGroup,
    removeFromGroup,
    leaveGroup,
    clearChat,
    getSharedGroups,
    deleteChat,
    toggleFavorite,
    toggleMuteChat,
    toggleArchiveChat,
    togglePinChat,
    updateGroupAvatar,
    joinGroupViaInvite,
    getGroupInfo,
    updateGroupDescription,
    inviteGroupPreview
} from '../Controllers/chatController.js';
import { groupAvatarUpload } from '../Utils/multerSetup.js'; 

const router = express.Router();

router.post('/', authMiddleware, accessChat);
router.get('/', authMiddleware, fetchChats);


router.post('/group', authMiddleware, groupAvatarUpload.single('groupAvatar'), createGroupChat);

router.put('/group-leave', authMiddleware, leaveGroup);
router.put('/rename', authMiddleware, renameGroup);
router.put('/group-add', authMiddleware, addToGroup);
router.put('/group-remove', authMiddleware, removeFromGroup);
router.delete("/clear/:chatId", authMiddleware, clearChat)
router.get("/shared-groups/:userId", authMiddleware, getSharedGroups);
router.delete("/:chatId", authMiddleware, deleteChat);
router.patch('/meta/:chatId/favorite', authMiddleware, toggleFavorite);
router.patch('/meta/:chatId/mute', authMiddleware, toggleMuteChat);
router.patch('/meta/:chatId/archive', authMiddleware, toggleArchiveChat);
router.patch('/meta/:chatId/pin', authMiddleware, togglePinChat); 
router.post('/join/:inviteToken', authMiddleware, joinGroupViaInvite);
router.get("/:chatId", authMiddleware, getGroupInfo);
router.put("/group/:chatId/description", authMiddleware, updateGroupDescription);
router.get("/invite/:inviteToken", authMiddleware, inviteGroupPreview);


router.put(
    '/group-avatar/:chatId',
    authMiddleware,
    groupAvatarUpload.single('groupAvatar'),
    updateGroupAvatar
);



export default router;
