import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { errorHandler, notFound } from "./middleware/errorMiddleware";

// Import routes
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.route";
import itineraryRoutes from "./routes/itinerary.route";

const app: Application = express();

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // disable if serving inline scripts
    referrerPolicy: { policy: "no-referrer" },
  })
);

// Trust proxy (needed if behind reverse proxy like Nginx/Heroku)
app.set("trust proxy", 1);

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(",") || [
    "https://wander-wise-lovat.vercel.app",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Body Parser Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie Parser
app.use(cookieParser());

// Compression Middleware
app.use(compression());

// Logger Middleware
const logFormat = process.env.NODE_ENV === "development" ? "dev" : "combined";
app.use(morgan(logFormat));

// Health Check Route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API Info Route
app.get("/api", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "WanderWise API is running",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      itineraries: "/api/itineraries",
    },
  });
});

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/itineraries", itineraryRoutes);

// 404 Handler - Must be after all routes
app.use(notFound);

// Global Error Handler - Must be last
app.use(errorHandler);

export default app;
