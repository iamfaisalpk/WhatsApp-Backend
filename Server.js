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
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [process.env.CLIENT_URL];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Test Route
app.get("/api/test", (req, res) => {
  res.status(200).json({
    message: "Server is running!",
    environment: process.env.NODE_ENV || "production",
    time: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.send("Backend is live!");
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
  console.log(` Test API: http://localhost:${PORT}/api/test`);
});
