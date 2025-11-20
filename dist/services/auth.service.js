"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordService = exports.forgotPasswordService = exports.resendVerificationService = exports.verifyUserService = exports.loginUserService = exports.registerUserService = void 0;
const user_model_1 = require("../models/user.model");
const errorMiddleware_1 = require("../middleware/errorMiddleware");
const generateToken_1 = require("../utils/generateToken");
const sendEmail_1 = require("../utils/sendEmail");
const emailTemplate_1 = require("../utils/emailTemplate");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
/**
 * Register a new user and send verification email
 */
const registerUserService = async (data) => {
    const { firstName, lastName, email, password } = data;
    console.log("Register service - Received:", { firstName, lastName, email, password: "***" });
    const existingUser = await user_model_1.User.findOne({ email });
    if (existingUser)
        throw new errorMiddleware_1.AppError("Email already exists", 400, "DUPLICATE_KEY");
    const user = await user_model_1.User.create({ firstName, lastName, email, password });
    // Generate verification token
    const { token: verificationToken, expires } = (0, generateToken_1.generateToken)(32, 24); // 24 hours
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = expires;
    await user.save();
    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const url = `${frontendUrl}/verify?token=${verificationToken}`;
    const html = (0, emailTemplate_1.generateEmailTemplate)(user.firstName, url, "verify");
    try {
        await (0, sendEmail_1.sendEmail)(user.email, "Verify Your WanderWise Account", html);
    }
    catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Don't fail registration if email fails - user can resend
    }
    const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1d",
    });
    return {
        success: true,
        message: "Registration successful! Check your email to verify your account.",
        token,
        user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        },
    };
};
exports.registerUserService = registerUserService;
/**
 * Login user and generate JWT
 */
const loginUserService = async (data) => {
    const { email, password } = data;
    const user = await user_model_1.User.findOne({ email }).select("+password");
    if (!user)
        throw new errorMiddleware_1.AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    if (!user.isVerified)
        throw new errorMiddleware_1.AppError("Please verify your email first", 401, "EMAIL_NOT_VERIFIED");
    const isMatch = await user.comparePassword(password);
    if (!isMatch)
        throw new errorMiddleware_1.AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1d",
    });
    return {
        success: true,
        token,
        user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        },
    };
};
exports.loginUserService = loginUserService;
/**
 * Verify user's email
 */
const verifyUserService = async (data) => {
    const { token } = data;
    const user = await user_model_1.User.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: new Date() },
    });
    if (!user)
        throw new errorMiddleware_1.AppError("Verification token is invalid or expired", 400, "INVALID_TOKEN");
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();
    // Generate JWT token for auto-login
    const jwtToken = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1d",
    });
    return {
        success: true,
        message: "Email verified successfully! Welcome to WanderWise!",
        token: jwtToken,
        user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isVerified: true,
        },
    };
};
exports.verifyUserService = verifyUserService;
/**
 * Resend verification email
 */
const resendVerificationService = async (data) => {
    const { email } = data;
    const user = await user_model_1.User.findOne({ email });
    if (!user)
        throw new errorMiddleware_1.AppError("User not found", 404, "USER_NOT_FOUND");
    if (user.isVerified)
        throw new errorMiddleware_1.AppError("Email already verified", 400, "ALREADY_VERIFIED");
    const { token, expires } = (0, generateToken_1.generateToken)(32, 24); // 24 hours
    user.verificationToken = token;
    user.verificationTokenExpires = expires;
    await user.save();
    const url = `${process.env.FRONTEND_URL}/verify?token=${token}`;
    const html = (0, emailTemplate_1.generateEmailTemplate)(user.firstName, url, "verify");
    await (0, sendEmail_1.sendEmail)(user.email, "Verify Your WanderWise Account", html);
    return { success: true, message: "Verification email resent successfully" };
};
exports.resendVerificationService = resendVerificationService;
/**
 * Forgot password - send reset email
 */
const forgotPasswordService = async (data) => {
    const { email } = data;
    const user = await user_model_1.User.findOne({ email });
    if (!user)
        throw new errorMiddleware_1.AppError("User not found", 404, "USER_NOT_FOUND");
    const { token, expires } = (0, generateToken_1.generateToken)(32, 1); // 1 hour
    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const url = `${frontendUrl}/reset-password?token=${token}`;
    const html = (0, emailTemplate_1.generateEmailTemplate)(user.firstName, url, "reset");
    try {
        await (0, sendEmail_1.sendEmail)(user.email, "Reset Your WanderWise Password", html);
    }
    catch (emailError) {
        console.error("Email sending failed:", emailError);
    }
    return { success: true, message: "Password reset email sent" };
};
exports.forgotPasswordService = forgotPasswordService;
/**
 * Reset password using token
 */
const resetPasswordService = async (data) => {
    const { token, newPassword } = data;
    const user = await user_model_1.User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() },
    }).select("+password");
    if (!user)
        throw new errorMiddleware_1.AppError("Reset token is invalid or expired", 400, "INVALID_TOKEN");
    // 🔥 Compare new password with old one
    const isSamePassword = await bcryptjs_1.default.compare(newPassword, user.password);
    if (isSamePassword) {
        throw new errorMiddleware_1.AppError("New password cannot be the same as the old password", 400, "SAME_PASSWORD");
    }
    // Update password
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    return { success: true, message: "Password reset successfully" };
};
exports.resetPasswordService = resetPasswordService;
