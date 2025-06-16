import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
    folder: 'whatsapp-clone',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
},
});

// Optional: File filter for extra safety
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
} else {
    cb(new Error('Only JPEG, PNG, and WEBP files are allowed'));
}
};

// Setup Multer
const upload = multer({ 
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, 
    fileFilter,
});

export default upload;
