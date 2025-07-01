import jwt from 'jsonwebtoken';
import User from '../Models/User.js';
import mongoose from 'mongoose';

const authMiddleware = async (req, res, next) => {
  try {
    console.log(' Auth middleware called for:', req.method, req.path);
    
    const authHeader = req.headers.authorization;
    console.log(' Auth header:', authHeader ? 'Present' : 'Missing');
    console.log("📥 Incoming Authorization Header:", req.headers.authorization);


    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Invalid auth header format');
      return res.status(401).json({
        success: false,
        message: 'Authorization token missing or invalid format. Expected: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log(' No token found after Bearer');
      return res.status(401).json({
        success: false,
        message: 'Access token not found',
      });
    }

    console.log('Token found, length:', token.length);

    if (!process.env.JWT_SECRET) {
      console.log(' JWT_SECRET missing from environment');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error (missing JWT_SECRET)',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(' Token decoded successfully, user ID:', decoded.id);
    } catch (err) {
      console.log(' Token verification failed:', err.name, err.message);
      let msg = 'Invalid or expired token';
      if (err.name === 'TokenExpiredError') msg = 'Token has expired. Please login again.';
      else if (err.name === 'JsonWebTokenError') msg = 'Invalid token format or signature.';
      else if (err.name === 'NotBeforeError') msg = 'Token not active yet.';

      return res.status(401).json({ success: false, message: msg });
    }

    if (!decoded?.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
      console.log(' Invalid token payload, decoded ID:', decoded?.id);
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload',
      });
    }

    console.log(' Looking for user with ID:', decoded.id);
    
    // Use +otp +otpExpiry to include hidden fields if needed
    const user = await User.findById(decoded.id).select('+otp +otpExpiry');
    
    if (!user) {
      console.log(' User not found in database:', decoded.id);
      return res.status(404).json({
        success: false,
        message: 'User not found. Account may have been deleted.',
      });
    }

    console.log(' User found:', user.phone, 'Active:', user.isActive);

    if (user.isActive === false) {
      console.log(' User account is deactivated');
      return res.status(403).json({
        success: false,
        message: 'User account is deactivated',
      });
    }

    req.user = {
      id: user._id.toString(),
      phone: user.phone,
      name: user.name || null,
      profilePic: user.profilePic || null,
      isVerified: user.isVerified,
      isOnline: user.isOnline,
    };

    console.log(' Auth successful, user object set for:', req.user.phone);
    next();

  } catch (err) {
    console.error(' Auth middleware error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
    });
  }
};

export default authMiddleware;