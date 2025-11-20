import { User } from "../models/user.model";
import { AppError } from "../middleware/errorMiddleware";
import { generateToken } from "../utils/generateToken";
import { sendEmail } from "../utils/sendEmail";
import { generateEmailTemplate } from "../utils/emailTemplate";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import {
  RegisterDTO,
  LoginDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
} from "../dtos/auth.dto";

/**
 * Register a new user
 */
export const registerUserService = async (data: RegisterDTO) => {
  const { firstName, lastName, email, password } = data;

  console.log("Register service - Received:", { firstName, lastName, email, password: "***" });

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    console.log("User already exists:", email);
    throw new AppError("Email already exists", 400, "DUPLICATE_KEY");
  }

  // Create the user with isVerified = true (no email verification needed)
  console.log("Creating new user...");
  const user = await User.create({ 
    firstName, 
    lastName, 
    email, 
    password,
    isVerified: true // Set to true immediately - no email verification required
  });
  console.log("User created successfully:", user._id);

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
    expiresIn: "1d",
  });

  console.log("Registration completed successfully");
  return {
    success: true,
    message: "Registration successful! You can now login.",
    token,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isVerified: true,
    },
  };
};

/**
 * Login user and generate JWT
 */
export const loginUserService = async (data: LoginDTO) => {
  const { email, password } = data;

  const user = await User.findOne({ email }).select("+password");
  if (!user)
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  const isMatch = await user.comparePassword(password);
  if (!isMatch)
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
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

/**
 * Forgot password - send reset email
 */
export const forgotPasswordService = async (data: ForgotPasswordDTO) => {
  const { email } = data;

  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

  const { token, expires } = generateToken(32, 1); // 1 hour
  user.resetPasswordToken = token;
  user.resetPasswordExpires = expires;
  await user.save();

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const url = `${frontendUrl}/reset-password?token=${token}`;
  const html = generateEmailTemplate(user.firstName, url, "reset");
  
  try {
    await sendEmail(user.email, "Reset Your WanderWise Password", html);
  } catch (emailError) {
    console.error("Email sending failed:", emailError);
  }

  return { success: true, message: "Password reset email sent" };
};

/**
 * Reset password using token
 */
export const resetPasswordService = async (data: ResetPasswordDTO) => {
  const { token, newPassword } = data;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  }).select("+password");

  if (!user)
    throw new AppError(
      "Reset token is invalid or expired",
      400,
      "INVALID_TOKEN"
    );

  // 🔥 Compare new password with old one
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new AppError(
      "New password cannot be the same as the old password",
      400,
      "SAME_PASSWORD"
    );
  }

  // Update password
  user.password = newPassword;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  return { success: true, message: "Password reset successfully" };
};
