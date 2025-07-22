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
import tokenRoutes from './Routes/tokenRoutes.js'
import errorHandler from "./Middlewares/errorHandler.js";
import { setupSocket } from "./Socket.js";

const app = express();
const server = http.createServer(app);

// DB Connect
connectDB();

// Middlewares
app.use(express.json({ limit: "10mb" }));

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'https://whats-app-frontend-nu.vercel.app', // Current frontend URL
      'https://whats-app-frontend-foqf7bzf1-faisals-projects-cd7c20ca.vercel.app', // Previous URL
      'http://localhost:3000', // for local development
      'http://localhost:5173', // for Vite dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ].filter(Boolean); // Remove any undefined values
    
    // Allow any Vercel preview deployment for this project
    const isVercelPreview = origin && origin.match(/^https:\/\/whats-app-frontend-.*\.vercel\.app$/);
    
    if (allowedOrigins.includes(origin) || isVercelPreview) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
    
    console.log('Request origin:', origin);
    console.log('Allowed origins:', allowedOrigins);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token'
  ],
  exposedHeaders: ['Authorization'],
  maxAge: 86400 // Cache preflight response for 24 hours
};

app.use(cors(corsOptions));

// Additional CORS handling for preflight requests
app.options('*', cors(corsOptions));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/", (req, res) => {
  res.send(" WhatsApp Clone Backend is Live!");
});

// Test Route
app.get("/api/test", (req, res) => {
  res.status(200).json({
    message: "Server is running!",
    environment: process.env.NODE_ENV || "production",
    time: new Date().toISOString(),
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
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`\n Server running on http://localhost:${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || "production"}`);
    console.log(` Test API: http://localhost:${PORT}/api/test`);
    console.log(` CLIENT_URL: ${process.env.CLIENT_URL}`);
});