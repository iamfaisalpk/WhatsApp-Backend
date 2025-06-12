import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
cloudinary: cloudinary,
params: {
    folder: 'whatsapp-clone', 
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
},
});

// Setup Multer with Cloudinary storage
const upload = multer({ storage });

export default upload;
