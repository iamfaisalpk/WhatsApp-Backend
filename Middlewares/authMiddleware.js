// import jwt from 'jsonwebtoken';
// import User from '../Models/User.js';

// const authMiddleware = async (req, res, next) => {
//     try {
//         // Debug: Log incoming headers
//         console.log('Auth middleware - Headers:', {
//             authorization: req.headers.authorization,
//             'content-type': req.headers['content-type']
//         });

//         const authHeader = req.headers.authorization;

//         // Check if Bearer token exists
//         if (!authHeader || !authHeader.startsWith('Bearer ')) {
//             console.log('Auth middleware - Missing or invalid authorization header');
//             return res.status(401).json({
//                 success: false,
//                 message: 'Authorization token missing or invalid format. Expected: Bearer <token>',
//             });
//         }

//         const token = authHeader.split(' ')[1];
//         if (!token) {
//             console.log('Auth middleware - Token not found after Bearer');
//             return res.status(401).json({
//                 success: false,
//                 message: 'Access token not found',
//             });
//         }

//         // Debug: Log token (first 20 chars for security)
//         console.log('Auth middleware - Token received:', token.substring(0, 20) + '...');

//         // Check if JWT_SECRET exists
//         if (!process.env.JWT_SECRET) {
//             console.error('Auth middleware - JWT_SECRET not found in environment variables');
//             return res.status(500).json({
//                 success: false,
//                 message: 'Server configuration error',
//             });
//         }

//         // Verify token using secret
//         let decoded;
//         try {
//             decoded = jwt.verify(token, process.env.JWT_SECRET);
//             console.log('Auth middleware - Token decoded successfully:', { id: decoded.id });
//         } catch (jwtError) {
//             console.error('Auth middleware - JWT verification failed:', jwtError.message);
            
//             // Provide specific error messages for different JWT errors
//             let errorMessage = 'Invalid or expired token';
//             if (jwtError.name === 'TokenExpiredError') {
//                 errorMessage = 'Token has expired. Please login again.';
//             } else if (jwtError.name === 'JsonWebTokenError') {
//                 errorMessage = 'Invalid token format or signature.';
//             } else if (jwtError.name === 'NotBeforeError') {
//                 errorMessage = 'Token not active yet.';
//             }

//             return res.status(401).json({
//                 success: false,
//                 message: errorMessage,
//                 error: jwtError.name
//             });
//         }

//         // Check if decoded token has required fields
//         if (!decoded?.id) {
//             console.log('Auth middleware - Invalid token payload, missing id:', decoded);
//             return res.status(401).json({
//                 success: false,
//                 message: 'Invalid token payload - missing user ID',
//             });
//         }

//         // Find user in database
//         let user;
//         try {
//             user = await User.findById(decoded.id).select('-otp -__v');
//             console.log('Auth middleware - User lookup result:', user ? 'Found' : 'Not found');
//         } catch (dbError) {
//             console.error('Auth middleware - Database error:', dbError.message);
//             return res.status(500).json({
//                 success: false,
//                 message: 'Database error during user verification',
//             });
//         }

//         if (!user) {
//             console.log('Auth middleware - User not found in database for ID:', decoded.id);
//             return res.status(404).json({
//                 success: false,
//                 message: 'User not found. Account may have been deleted.',
//             });
//         }

//         // Attach user to request object
//         req.user = { 
//             id: user._id, 
//             phone: user.phone,
//             name: user.name,
//             profilePic: user.profilePic
//         };
        
//         console.log('Auth middleware - Success, user attached to request');
//         next();

//     } catch (error) {
//         console.error('Auth middleware - Unexpected error:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Internal server error during authentication',
//             error: process.env.NODE_ENV === 'development' ? error.message : 'Authentication failed'
//         });
//     }
// };

// export default authMiddleware;




import jwt from 'jsonwebtoken';
import User from '../Models/User.js';
import mongoose from 'mongoose';

const authMiddleware = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware called for:', req.method, req.path);
    
    const authHeader = req.headers.authorization;
    console.log('📝 Auth header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Invalid auth header format');
      return res.status(401).json({
        success: false,
        message: 'Authorization token missing or invalid format. Expected: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('❌ No token found after Bearer');
      return res.status(401).json({
        success: false,
        message: 'Access token not found',
      });
    }

    console.log('🔑 Token found, length:', token.length);

    if (!process.env.JWT_SECRET) {
      console.log('❌ JWT_SECRET missing from environment');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error (missing JWT_SECRET)',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token decoded successfully, user ID:', decoded.id);
    } catch (err) {
      console.log('❌ Token verification failed:', err.name, err.message);
      let msg = 'Invalid or expired token';
      if (err.name === 'TokenExpiredError') msg = 'Token has expired. Please login again.';
      else if (err.name === 'JsonWebTokenError') msg = 'Invalid token format or signature.';
      else if (err.name === 'NotBeforeError') msg = 'Token not active yet.';

      return res.status(401).json({ success: false, message: msg });
    }

    if (!decoded?.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
      console.log('❌ Invalid token payload, decoded ID:', decoded?.id);
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload',
      });
    }

    console.log('🔍 Looking for user with ID:', decoded.id);
    
    // Use +otp +otpExpiry to include hidden fields if needed
    const user = await User.findById(decoded.id).select('+otp +otpExpiry');
    
    if (!user) {
      console.log('❌ User not found in database:', decoded.id);
      return res.status(404).json({
        success: false,
        message: 'User not found. Account may have been deleted.',
      });
    }

    console.log('✅ User found:', user.phone, 'Active:', user.isActive);

    if (user.isActive === false) {
      console.log('❌ User account is deactivated');
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

    console.log('✅ Auth successful, user object set for:', req.user.phone);
    next();

  } catch (err) {
    console.error('❌ Auth middleware error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
    });
  }
};

export default authMiddleware;