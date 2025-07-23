import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import morgan from "morgan";

import connectDB from "./config/db.js";
import authRoutes from "./Routes/authRoutes.js";
import profileRoutes from "./Routes/profileRoutes.js";
import messageRoutes from "./Routes/messageRoutes.js";
import communityRoutes from "./Routes/communityRoutes.js";
import chatRoutes from "./Routes/chatRoutes.js";
import userRoutes from "./Routes/userRoutes.js";
import chatMetaRoutes from "./Routes/chatMetaRoutes.js";
import tokenRoutes from "./Routes/tokenRoutes.js";
import errorHandler from "./Middlewares/errorHandler.js";
import { setupSocket } from "./Socket.js";

const app = express();
const server = http.createServer(app);

// DB Connect
connectDB();

// Middlewares
app.use(express.json({ limit: "10mb" }));

// Improved CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        process.env.CLIENT_URL,
        'https://whats-app-frontend-nu.vercel.app', // Add explicit URL as fallback
        'http://localhost:3000', // For local development
        'http://localhost:5173', // For Vite development
      ].filter(Boolean); // Remove any undefined values
      
      console.log('Request origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type", 
      "Authorization", 
      "x-requested-with",
      "Access-Control-Allow-Origin"
    ],
    preflightContinue: false,
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  })
);

// Add explicit preflight handling for all routes
app.options('*', cors());

// Add CORS headers manually as a fallback
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.CLIENT_URL,
    'https://whats-app-frontend-nu.vercel.app'
  ].filter(Boolean);
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  next();
});

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Debug Route - Check environment variables and CORS setup
app.get("/api/debug", (req, res) => {
  res.status(200).json({
    message: "Debug Info",
    environment: process.env.NODE_ENV || "production",
    clientUrl: process.env.CLIENT_URL,
    port: process.env.PORT,
    time: new Date().toISOString(),
    headers: req.headers,
    origin: req.headers.origin,
    corsInfo: {
      allowedOrigins: [
        process.env.CLIENT_URL,
        'https://whats-app-frontend-nu.vercel.app'
      ].filter(Boolean)
    }
  });
});

// Test Route
app.get("/api/test", (req, res) => {
  res.status(200).json({
    message: "Server is running!",
    environment: process.env.NODE_ENV || "production",
    time: new Date().toISOString(),
    corsEnabled: true,
    clientUrl: process.env.CLIENT_URL
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat-meta", chatMetaRoutes);
app.use("/api/token", tokenRoutes);

app.use(errorHandler);

// Socket.io setup
setupSocket(server, app);

server.timeout = 120000;

// Server Listen
const PORT = process.env.PORT;

server.listen(PORT, () => {
  console.log(`\n Server running on http://localhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || "production"}`);
  console.log(` CLIENT_URL: ${process.env.CLIENT_URL || "NOT SET"}`);
  console.log(` Test API: http://localhost:${PORT}/api/test`);
  console.log(` Debug API: http://localhost:${PORT}/api/debug`);
  
  // Log CORS configuration
  const allowedOrigins = [
    process.env.CLIENT_URL,
    'https://whats-app-frontend-nu.vercel.app'
  ].filter(Boolean);
  console.log(` CORS Allowed Origins:`, allowedOrigins);
});