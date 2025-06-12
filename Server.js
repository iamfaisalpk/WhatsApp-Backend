import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";

import connectDB from "./config/db.js";
import authRoutes from "./Routes/authRoutes.js";
import { setupSocket } from "./Socket.js"; 

// Initialize Express app
const app = express();

// Create HTTP server for Socket.io
const server = http.createServer(app);

// Middlewares
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
}));

// Connect to MongoDB
connectDB();

// Basic Test Route
app.get("/api/test", (req, res) => {
res.json({
    message: "Server is working!",
    environment: process.env.NODE_ENV || "production",
    developmentMode: process.env.NODE_ENV === "development",
    timestamp: new Date().toISOString(),
});
});

// Auth Routes
app.use("/api/auth", authRoutes);

// Socket.io Setup
setupSocket(server, app);

// Server Port
const PORT = process.env.PORT || 3000;

// Start Server
server.listen(PORT, () => {
    console.log(`\n Server running on port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "production"}`);
    console.log(`Test URL: http://localhost:${PORT}/api/test`);
    console.log(`Auth routes: http://localhost:${PORT}/api/auth`);

    // Development-specific logs
if (process.env.NODE_ENV === "development") {
    console.log("\n DEVELOPMENT MODE ACTIVE");
    console.log("Your number (+917994010513) will receive real SMS.");
    console.log("Other numbers get OTP in API response (for testing).");
    console.log("Debug endpoints available:");
    console.log("  ├─ GET /api/auth/otp-status?phone=<number>");
    console.log("  └─ GET /api/auth/dev-status");
    console.log("━━━━━\n");
}
});

export default app