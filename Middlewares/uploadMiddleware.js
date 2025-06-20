import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// Test Cloudinary connection first
console.log(' Testing Cloudinary configuration...');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? ' Set' : ' Missing');
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? ' Set' : ' Missing');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? ' Set' : ' Missing');

// Simplified storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'whatsapp-clone',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
});

// Simple file filter
const fileFilter = (req, file, cb) => {
  console.log(' Processing file:', file.originalname, file.mimetype);
  
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    console.log(' File type accepted');
    cb(null, true);
  } else {
    console.log(' File type rejected:', file.mimetype);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

// Simple multer setup
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, 
  },
  fileFilter,
});

// Create the uploadSingle middleware
export const uploadSingle = (fieldName) => upload.single(fieldName);

// Export the upload instance as default
export default upload;