import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

console.log(' Testing Cloudinary configuration...');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? ' Set' : ' Missing');
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? ' Set' : ' Missing');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? ' Set' : ' Missing');

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const isImage = file.mimetype.startsWith("image");
    const isAudio = file.mimetype.startsWith("audio");
    const isVideo = file.mimetype.startsWith("video");

    let folder = "whatsapp-clone/files";
    if (isImage) folder = "whatsapp-clone/images";
    else if (isAudio) folder = "whatsapp-clone/audio";
    else if (isVideo) folder = "whatsapp-clone/video";

    return {
      folder,
      resource_type: "auto", 
      allowed_formats: ["jpg", "png", "jpeg", "webp", "mp4", "webm", "mp3", "wav", "pdf"],
      transformation: isImage ? [{ width: 500, height: 500, crop: 'limit' }] : [],
    };
  },
});

const fileFilter = (req, file, cb) => {
  console.log(' Processing file:', file.originalname, file.mimetype);
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm',
    'application/pdf',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    console.log(' File type accepted');
    cb(null, true);
  } else {
    console.log(' File type rejected:', file.mimetype);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
  fileFilter,
});

export const uploadSingle = (fieldName) => upload.single(fieldName);
export default upload;
