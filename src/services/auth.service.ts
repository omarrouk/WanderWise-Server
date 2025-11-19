import { User } from "../models/User.model";
import { AppError } from "../middleware/errorMiddleware";
import { generateToken } from "../utils/generateToken";
import { sendEmail } from "../utils/sendEmail";
import { generateEmailTemplate } from "../utils/emailTemplate";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import {
  RegisterDTO,
  LoginDTO,
  VerifyEmailDTO,
  ResendVerificationDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
} from "../dtos/auth.dto";

/**
 * Register a new user and send verification email
 */
export const registerUserService = async (data: RegisterDTO) => {
  const { firstName, lastName, email, password } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser)
    throw new AppError("Email already exists", 400, "DUPLICATE_KEY");

  const user = await User.create({ firstName, lastName, email, password });

  // Generate verification token
  const { token: verificationToken, expires } = generateToken(32, 24); // 24 hours
  user.verificationToken = verificationToken;
  user.verificationTokenExpires = expires;
  await user.save();

  // Send verification email
  const url = `${process.env.FRONTEND_URL}/verify?token=${verificationToken}`;
  const html = generateEmailTemplate(user.firstName, url, "verify");
  await sendEmail(user.email, "Verify Your WanderWise Account", html);

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
    expiresIn: "1d",
  });

  return {
    success: true,
    message:
      "Registration successful! Check your email to verify your account.",
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
 * Login user and generate JWT
 */
export const loginUserService = async (data: LoginDTO) => {
  const { email, password } = data;

  const user = await User.findOne({ email }).select("+password");
  if (!user)
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  if (!user.isVerified)
    throw new AppError(
      "Please verify your email first",
      401,
      "EMAIL_NOT_VERIFIED"
    );

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
 * Verify user's email
 */
export const verifyUserService = async (data: VerifyEmailDTO) => {
  const { token } = data;

  const user = await User.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: new Date() },
  });

  if (!user)
    throw new AppError(
      "Verification token is invalid or expired",
      400,
      "INVALID_TOKEN"
    );

  user.isVerified = true;
  user.verificationToken = null;
  user.verificationTokenExpires = null;
  await user.save();

  return {
    success: true,
    message: "Email verified successfully! You can now login.",
    user: { id: user._id, email: user.email },
  };
};

/**
 * Resend verification email
 */
export const resendVerificationService = async (
  data: ResendVerificationDTO
) => {
  const { email } = data;

  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  if (user.isVerified)
    throw new AppError("Email already verified", 400, "ALREADY_VERIFIED");

  const { token, expires } = generateToken(32, 24); // 24 hours
  user.verificationToken = token;
  user.verificationTokenExpires = expires;
  await user.save();

  const url = `${process.env.FRONTEND_URL}/verify?token=${token}`;
  const html = generateEmailTemplate(user.firstName, url, "verify");
  await sendEmail(user.email, "Verify Your WanderWise Account", html);

  return { success: true, message: "Verification email resent successfully" };
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

  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const html = generateEmailTemplate(user.firstName, url, "reset");
  await sendEmail(user.email, "Reset Your WanderWise Password", html);

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
