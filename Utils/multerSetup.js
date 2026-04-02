import fs from 'fs';
import path from 'path';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

// Setup local disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

// A factory function to make customized Cloudinary middleware
const makeCloudinaryMiddleware = (folder, optionsCallback) => async (req, res, next) => {
  if (!req.files && !req.file) return next();

  try {
    const uploadPromises = [];

    const processFile = async (file) => {
      const localPath = file.path;
      const options = { folder, ...optionsCallback(file) };
      
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(localPath, options, (error, res) => {
          if (error) reject(error);
          else resolve(res);
        });
      });
      
      if (result && result.secure_url) {
        file.path = result.secure_url;
      } else {
        throw new Error("Missing secure_url from Cloudinary");
      }

      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    };

    if (req.files) {
      if (Array.isArray(req.files)) {
        req.files.forEach(f => uploadPromises.push(processFile(f)));
      } else {
        Object.values(req.files).forEach(arr => arr.forEach(f => uploadPromises.push(processFile(f))));
      }
    } else if (req.file) {
      uploadPromises.push(processFile(req.file));
    }

    await Promise.all(uploadPromises);
    next();
  } catch (err) {
    console.error("Cloudinary custom middleware upload failed:", err);
    next(err);
  }
};

// General file filter
const generalFileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/mov", "video/avi", "video/quicktime",
    "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`File type not allowed: ${file.mimetype}`));
};

// Image filters
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error(`Only image files are allowed. Received: ${file.mimetype}`));
};

// Multer instances
const baseUpload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: generalFileFilter });
const baseAvatarUpload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });

// Cloudinary Midlewares
const generalCloudinary = makeCloudinaryMiddleware("whatsapp-clone/uploads", () => ({ resource_type: "auto" }));
const groupAvatarCloudinary = makeCloudinaryMiddleware("whatsapp-clone/group-avatars", () => ({
  resource_type: "image",
  transformation: [
    { width: 500, height: 500, crop: "fill", gravity: "center" },
    { quality: "auto", format: "webp" }
  ]
}));
const profileAvatarCloudinary = makeCloudinaryMiddleware("whatsapp-clone/profile-avatars", () => ({
  resource_type: "image",
  transformation: [
    { width: 300, height: 300, crop: "fill", gravity: "center" },
    { quality: "auto", format: "webp" }
  ]
}));

// Exports wrapping the middlewares in arrays for routing
export const groupAvatarUpload = {
  single: (field) => [baseAvatarUpload.single(field), groupAvatarCloudinary]
};
export const profileAvatarUpload = {
  single: (field) => [baseAvatarUpload.single(field), profileAvatarCloudinary]
};

// Utility functions
export const uploadSingle = (field) => [baseUpload.single(field), generalCloudinary];
export const uploadFields = (fields) => [baseUpload.fields(fields), generalCloudinary];
export const uploadAny = () => [baseUpload.any(), generalCloudinary];
export const uploadGroupAvatar = (field = 'groupAvatar') => groupAvatarUpload.single(field);
export const uploadProfileAvatar = (field = 'profileAvatar') => profileAvatarUpload.single(field);

export const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: 'File upload error: ' + error.code, error: error.message });
  } else if (error) {
    return res.status(400).json({ success: false, message: 'File validation error', error: error.message });
  }
  next();
};

export default baseUpload;