import express from 'express';
import authMiddleware from '../Middlewares/authMiddleware.js';
import {
    createCommunity,
    addToCommunity,
    removeFromCommunity,
    fetchMyCommunities
} from '../Controllers/communityController.js';

const router = express.Router();

router.post('/create', authMiddleware, createCommunity);
router.put('/add', authMiddleware, addToCommunity);
router.put('/remove', authMiddleware, removeFromCommunity);
router.get('/my-communities', authMiddleware, fetchMyCommunities);

export default router;
