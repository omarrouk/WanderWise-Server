import { Schema, model, Document } from "mongoose";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { IUser } from "../types/user.type";

export interface IUserDocument extends Omit<IUser, "_id">, Document {
  _id: ObjectId;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getPublicProfile(): Omit<IUserDocument, "password">;
  isPasswordExpired(): boolean;
  isVerificationTokenExpired(): boolean;
}

const userSchema = new Schema<IUserDocument>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
      minlength: [6, "Password must be at least 6 characters"],
    },
    avatar: {
      type: String,
      default: "",
    },
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
    verificationToken: {
      type: String,
      default: null,
      select: false,
    },
    verificationTokenExpires: {
      type: Date,
      default: null,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
userSchema.virtual("fullName").get(function (this: IUserDocument) {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
userSchema.pre<IUserDocument>("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (
  this: IUserDocument,
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// Get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function (
  this: IUserDocument
): Omit<IUserDocument, "password"> {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  delete userObject.verificationToken;
  delete userObject.verificationTokenExpires;
  return userObject;
};

// Check if password reset token is expired
userSchema.methods.isPasswordExpired = function (this: IUserDocument): boolean {
  if (!this.resetPasswordExpires) return true;
  return new Date() > this.resetPasswordExpires;
};

// Check if verification token is expired
userSchema.methods.isVerificationTokenExpired = function (
  this: IUserDocument
): boolean {
  if (!this.verificationTokenExpires) return true;
  return new Date() > this.verificationTokenExpires;
};

// Indexes for better query performance
userSchema.index({ createdAt: -1 });

export const User = model<IUserDocument>("User", userSchema);
