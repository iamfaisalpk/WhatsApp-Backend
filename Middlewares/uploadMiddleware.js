import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

//  Logging Cloudinary environment check
console.log(" Cloudinary Config Check:");
console.log("  - CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("  - API_KEY:", process.env.CLOUDINARY_API_KEY);
console.log("  - API_SECRET:", process.env.CLOUDINARY_API_SECRET);

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
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
      allowed_formats: [
        "jpg", "jpeg", "png", "webp",
        "mp4", "webm", "mov",
        "mp3", "wav", "ogg", "m4a", "webm",
        "pdf"
      ],
      transformation: isImage
        ? [{ width: 500, height: 500, crop: "limit" }] 
        : [],
    };
  },
});

const fileFilter = (req, file, cb) => {
  console.log(" Uploading file:", file.originalname, "| Type:", file.mimetype);

  const allowedMimeTypes = [
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "video/mp4", "video/webm", "video/quicktime",
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/x-m4a", "audio/m4a", "audio/webm",
    "application/pdf"
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.warn(" Rejected file type:", file.mimetype);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

//  Multer setup
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
  fileFilter,
});

//  Export reusable middlewares
export const uploadSingle = (fieldName) => upload.single(fieldName); 
export const uploadFields = (fields) => upload.fields(fields);       
export const uploadAny = upload.any();                                

export default upload;
