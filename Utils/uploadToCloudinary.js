import cloudinary from "../config/cloudinary.js";
import fs from "fs";


export const uploadToCloudinary = async (filePath, folder = "chats") => {
try {
    const result = await cloudinary.uploader.upload(filePath, {
        folder,
        resource_type: "auto", 
    });

    fs.unlinkSync(filePath);

    return result; 
} catch (error) {
    console.error("Cloudinary Upload Failed:", error);
    throw error;
}
};
