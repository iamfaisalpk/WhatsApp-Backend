const errorHandler = (err, req, res, next) => {
console.error("Error:", err);

    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // Multer file upload error
if (err.name === "MulterError") {
    statusCode = 400;
    message = err.message || "File upload error (Multer)";
}

    // Cloudinary error
if (err.name === "CloudinaryError" || err.message?.includes("cloudinary")) {
    statusCode = 500;
    message = "Cloudinary upload failed";
}

    // Mongoose bad ObjectId
if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource ID";
}

    // Mongoose validation errors
if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
        .map((val) => val.message)
        .join(", ");
}

    // Handle custom thrown errors
if (err.customError) {
    statusCode = err.statusCode || 400;
    message = err.message;
}

res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
});
};

export default errorHandler;
