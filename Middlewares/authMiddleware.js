import jwt from 'jsonwebtoken';
import User from '../Models/User.js';

const authMiddleware = async (req, res, next) => {
try {
    const authHeader = req.headers.authorization;

    // Check if Bearer token exists
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
        success: false,
        message: 'Authorization token missing or invalid',
    });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({
        success: false,
        message: 'Access token not found',
        });
    }

    // Verify token using secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
        return res.status(401).json({
        success: false,
        message: 'Invalid token payload',
        });
    }

    // Find user
    const user = await User.findById(decoded.id).select('-otp -__v');
    if (!user) {
        return res.status(404).json({
        success: false,
        message: 'User not found',
        });
    }

    // Attach user to request
    req.user = { id: user._id, phone: user.phone };
    next();
} catch (error) {
    console.error('authMiddleware error:', error.message);
    return res.status(401).json({
        success: false,
        message: 'Unauthorized. Token may be expired or invalid.',
        error: error.message
    });
}
};

export default authMiddleware;
