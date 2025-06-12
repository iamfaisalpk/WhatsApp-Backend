import jwt from 'jsonwebtoken';
import User from '../Models/User.js';

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
        success: false,
        message: 'Authorization token missing or invalid',
    });
}

const token = authHeader.split(' ')[1];

try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-otp -__v');
    if (!user) {
        return res.status(401).json({
        success: false,
        message: 'User not found',
        });
    }

    req.user = user; 
    next();
} catch (error) {
    console.error('authMiddleware error:', error);
    return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
    });
}
};

export default authMiddleware;
