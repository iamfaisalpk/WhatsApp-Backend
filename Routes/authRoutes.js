import express from 'express';
import {
    sendOtp,
    verifyOtp,
    getOtpStatus,
    getDevelopmentStatus,
    clearAllOtps,
    getAllOtps
} from '../Controllers/authController.js';

const router = express.Router();

router.get('/test', (req, res) => {
    res.json({
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
});
});

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

if (process.env.NODE_ENV === 'development') {
    router.get('/otp-status', getOtpStatus);
    router.get('/dev-status', getDevelopmentStatus);
    router.get('/all-otps', getAllOtps);
    router.delete('/clear-otps', clearAllOtps);
}

export default router;
