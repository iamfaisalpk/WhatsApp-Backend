import express from 'express';
import {
    sendOtp,
    verifyOtp,
    getOtpStatus,
    getDevelopmentStatus,
    clearAllOtps,
    getAllOtps,
} from '../Controllers/authController.js';

import {
    refreshAccessToken,
    logoutUser,
    logoutAllDevices,
} from '../Controllers/tokenController.js';

import authMiddleware from '../Middlewares/authMiddleware.js';

const router = express.Router();

//  Health Check Route
router.get('/test', (req, res) => {
    res.json({
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString(),
});
});

//  OTP
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

//  Refresh Token Login
router.post('/refresh-token', refreshAccessToken);

//  Logout (single device)
router.post('/logout', logoutUser);

//  Logout (all devices)
router.post('/logout-all', authMiddleware, logoutAllDevices);

// Development Routes
if (process.env.NODE_ENV === 'development') {
    router.get('/otp-status', getOtpStatus);
    router.get('/dev-status', getDevelopmentStatus);
    router.get('/all-otps', getAllOtps);
    router.delete('/clear-otps', clearAllOtps);
}

export default router;
