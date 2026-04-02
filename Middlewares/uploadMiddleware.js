import fs from "fs";
import path from "path";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";

// 1. Setup local disk storage for robust file handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  console.log(" Uploading file:", file.originalname, "| Type:", file.mimetype);
  cb(null, true);
};

const baseUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter,
});

// 2. Custom middleware to upload to Cloudinary and convert req.files
const uploadToCloudinary = async (req, res, next) => {
  if (!req.files && !req.file) return next();

  try {
    const uploadPromises = [];

    const processFile = async (file) => {
      const isImage = file.mimetype.startsWith("image");
      const isAudio = file.mimetype.startsWith("audio");
      const isVideo = file.mimetype.startsWith("video");

      let folder = "whatsapp-clone/files";
      if (isImage) folder = "whatsapp-clone/images";
      else if (isAudio) folder = "whatsapp-clone/audio";
      else if (isVideo) folder = "whatsapp-clone/video";

      const options = {
        folder,
        resource_type: "auto",
      };

      if (isImage) {
        options.transformation = [{ width: 1000, height: 1000, crop: "limit" }];
      }

      const localPath = file.path;
      
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(localPath, options, (error, res) => {
          if (error) reject(error);
          else resolve(res);
        });
      });
      
      if (result && result.secure_url) {
        file.path = result.secure_url;
      } else {
        console.error("Cloudinary did not return a secure_url", result);
        throw new Error("Missing secure_url from Cloudinary");
      }

      if (fs.existsSync(localPath)) fs.unlinkSync(localPath); // Cleanup
    };

    if (req.files) {
      if (Array.isArray(req.files)) {
        req.files.forEach((file) => uploadPromises.push(processFile(file)));
      } else {
        Object.keys(req.files).forEach((field) => {
          req.files[field].forEach((file) => uploadPromises.push(processFile(file)));
        });
      }
    } else if (req.file) {
      uploadPromises.push(processFile(req.file));
    }

    await Promise.all(uploadPromises);
    next();
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    next(err);
  }
};

const upload = {
  single: (field) => [baseUpload.single(field), uploadToCloudinary],
  fields: (fields) => [baseUpload.fields(fields), uploadToCloudinary],
  any: () => [baseUpload.any(), uploadToCloudinary],
};

export const uploadSingle = upload.single;
export const uploadFields = upload.fields;
export const uploadAny = upload.any;

export default upload;
