export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const otpStore = new Map();

export const cleanupExpiredOTPs = () => {
const now = Date.now();
for (const [key, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
    otpStore.delete(key);
    }
}
};
