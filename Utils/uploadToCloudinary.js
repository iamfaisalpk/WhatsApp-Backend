import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import streamifier from "streamifier";

export const uploadToCloudinary = async (file, folder = "chats") => {
  return new Promise((resolve, reject) => {
    if (file?.buffer) {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "auto",
        },
        (error, result) => {
          if (error) {
            console.error(" Cloudinary buffer upload error:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      streamifier.createReadStream(file.buffer).pipe(stream);
    }

    else if (file?.path) {
      cloudinary.uploader
        .upload(file.path, {
          folder,
          resource_type: "auto",
        })
        .then((result) => {
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path); 
            }
          } catch (err) {
            console.warn(" Could not delete file:", err.message);
          }
          resolve(result);
        })
        .catch((error) => {
          console.error(" Cloudinary path upload error:", error);
          reject(error);
        });
    }

    else {
      reject(new Error(" No file.buffer or file.path found for upload."));
    }
  });
};
