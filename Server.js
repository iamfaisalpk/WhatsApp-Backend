import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import morgan from "morgan";

import connectDB from "./config/db.js";
import authRoutes from "./Routes/authRoutes.js";
import profileRoutes from "./Routes/profileRoutes.js";
import messageRoutes from "./Routes/messageRoutes.js"
import { setupSocket } from "./Socket.js";


const app = express();
const server = http.createServer(app);


connectDB();

// Middlewares
app.use(express.json({ limit: "10mb" }));
app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
}));

if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev")); 
}

//Test Route
app.get("/api/test", (req, res) => {
res.status(200).json({
    message: " Server is running!",
    environment: process.env.NODE_ENV || "production",
    time: new Date().toISOString(),
});
});

// All Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/messages",messageRoutes);


setupSocket(server, app);


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`\n Server running on http://localhost:${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || "production"}`);
    console.log(` Test API: http://localhost:${PORT}/api/test`);
    console.log(` Auth API: http://localhost:${PORT}/api/auth`);

if (process.env.NODE_ENV === "development") {
    console.log(`SMS testing mode enabled`);
    console.log(`OTP Dev Routes:`);
    console.log(`   • /api/auth/otp-status?phone=<number>`);
    console.log(`   • /api/auth/dev-status`);
    console.log("━━━━━━━━━━━━━━━");
}
});

export default app;
