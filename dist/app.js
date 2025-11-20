"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const errorMiddleware_1 = require("./middleware/errorMiddleware");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_route_1 = __importDefault(require("./routes/user.route"));
const itinerary_route_1 = __importDefault(require("./routes/itinerary.route"));
const app = (0, express_1.default)();
// Security Middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // disable if serving inline scripts
    referrerPolicy: { policy: "no-referrer" },
}));
// Trust proxy (needed if behind reverse proxy like Nginx/Heroku)
app.set("trust proxy", 1);
// CORS Configuration
const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : [
        "http://localhost:3000",
        "https://wander-wise-lovat.vercel.app",
        "https://wanderwise-server.onrender.com",
    ];
const corsOptions = {
    origin: corsOrigins,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
console.log("CORS Origins configured:", corsOrigins);
app.use((0, cors_1.default)(corsOptions));
// Rate Limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: "Too many requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api", limiter);
// Body Parser Middleware
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Cookie Parser
app.use((0, cookie_parser_1.default)());
// Compression Middleware
app.use((0, compression_1.default)());
// Logger Middleware
const logFormat = process.env.NODE_ENV === "development" ? "dev" : "combined";
app.use((0, morgan_1.default)(logFormat));
// Health Check Route
app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
    });
});
// API Info Route
app.get("/api", (req, res) => {
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
app.use("/api/v1/auth", auth_routes_1.default);
app.use("/api/v1/users", user_route_1.default);
app.use("/api/v1/itineraries", itinerary_route_1.default);
// 404 Handler - Must be after all routes
app.use(errorMiddleware_1.notFound);
// Global Error Handler - Must be last
app.use(errorMiddleware_1.errorHandler);
exports.default = app;
