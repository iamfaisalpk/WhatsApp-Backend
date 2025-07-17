import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

//  General storage configuration for regular uploads
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "whatsapp-clone/uploads",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "avi", "pdf", "doc", "docx"],
    transformation: [{ quality: "auto" }],
    resource_type: "auto"
  },
});

//  Group Avatar specific storage configuration
const groupAvatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "whatsapp-clone/group-avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 500, height: 500, crop: "fill", gravity: "center" },
      { quality: "auto", format: "webp" }
    ],
    resource_type: "image"
  },
});

//  Profile Avatar specific storage configuration
const profileAvatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "whatsapp-clone/profile-avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 300, height: 300, crop: "fill", gravity: "center" },
      { quality: "auto", format: "webp" }
    ],
    resource_type: "image"
  },
});

//  General file filter
const generalFileFilter = (req, file, cb) => {
  console.log("📎 Uploading file:", file.originalname, "| Type:", file.mimetype);
  
  const allowedMimeTypes = [
    // Images
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
    // Videos
    "video/mp4", "video/mov", "video/avi", "video/quicktime",
    // Documents
    "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.warn("❌ Rejected file type:", file.mimetype);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

//  Group Avatar specific file filter
const groupAvatarFileFilter = (req, file, cb) => {
  console.log("📎 Uploading group avatar:", file.originalname, "| Type:", file.mimetype);
  
  const allowedMimeTypes = [
    "image/jpeg", "image/jpg", "image/png", "image/webp"
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.warn("❌ Rejected file type for group avatar:", file.mimetype);
    cb(new Error(`Only image files are allowed for group avatars. Received: ${file.mimetype}`));
  }
};

//  Profile Avatar specific file filter
const profileAvatarFileFilter = (req, file, cb) => {
  console.log("📎 Uploading profile avatar:", file.originalname, "| Type:", file.mimetype);
  
  const allowedMimeTypes = [
    "image/jpeg", "image/jpg", "image/png", "image/webp"
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.warn("❌ Rejected file type for profile avatar:", file.mimetype);
    cb(new Error(`Only image files are allowed for profile avatars. Received: ${file.mimetype}`));
  }
};

//  General upload middleware
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for general files
  },
  fileFilter: generalFileFilter,
});

//  Group Avatar upload middleware
export const groupAvatarUpload = multer({
  storage: groupAvatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for group avatars
  },
  fileFilter: groupAvatarFileFilter,
});

//  Profile Avatar upload middleware
export const profileAvatarUpload = multer({
  storage: profileAvatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile avatars
  },
  fileFilter: profileAvatarFileFilter,
});

//  Image-only upload middleware (for general image uploads)
export const imageUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Only image files are allowed. Received: ${file.mimetype}`));
    }
  },
});

//  Video-only upload middleware
export const videoUpload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "video/mp4", "video/mov", "video/avi", "video/quicktime"
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Only video files are allowed. Received: ${file.mimetype}`));
    }
  },
});

//  Utility functions for different upload scenarios
export const uploadSingle = (fieldName) => upload.single(fieldName);
export const uploadFields = (fields) => upload.fields(fields);
export const uploadAny = upload.any();
export const uploadArray = (fieldName, maxCount = 10) => upload.array(fieldName, maxCount);

//  Specialized upload functions
export const uploadGroupAvatar = (fieldName = 'groupAvatar') => groupAvatarUpload.single(fieldName);
export const uploadProfileAvatar = (fieldName = 'profileAvatar') => profileAvatarUpload.single(fieldName);
export const uploadImage = (fieldName = 'image') => imageUpload.single(fieldName);
export const uploadVideo = (fieldName = 'video') => videoUpload.single(fieldName);

//  Multiple file uploads
export const uploadMultipleImages = (fieldName = 'images', maxCount = 10) => 
  imageUpload.array(fieldName, maxCount);

//  Mixed field uploads for chat messages
export const uploadChatFiles = uploadFields([
  { name: 'image', maxCount: 5 },
  { name: 'video', maxCount: 2 },
  { name: 'document', maxCount: 3 }
]);

//  Error handling middleware
export const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File size too large',
          error: error.message
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files uploaded',
          error: error.message
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field',
          error: error.message
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: error.message
        });
    }
  } else if (error) {
    return res.status(400).json({
      success: false,
      message: 'File validation error',
      error: error.message
    });
  }
  next();
};


export default upload;