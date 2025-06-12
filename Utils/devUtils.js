import { otpStore } from './otpUtils.js';

export const getAllOtps = (req, res) => {
    const now = Date.now();
    const activeOtps = [];

for (const [phone, data] of otpStore.entries()) {
    const isExpired = now > data.expiresAt;
    activeOtps.push({
    phone,
    otp: data.otp,
    status: isExpired ? 'expired' : 'active',
    attempts: data.attempts,
    expiresIn: Math.max(0, data.expiresAt - now),
    createdAt: new Date(data.createdAt).toISOString()
    });
}

res.json({
    success: true,
    totalOtps: activeOtps.length,
    activeOtps,
    developmentMode: true,
    timestamp: new Date().toISOString()
});
};

export const clearAllOtps = (req, res) => {
    const otpCount = otpStore.size;
    otpStore.clear();

res.json({
    success: true,
    message: `Cleared ${otpCount} stored OTPs`,
    developmentMode: true,
    timestamp: new Date().toISOString()
});
};
