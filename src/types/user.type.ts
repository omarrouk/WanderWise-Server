import { ObjectId } from "mongodb";

export interface IUser {
  _id?: ObjectId | string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  avatar: string;
  resetPasswordToken: string | null;
  resetPasswordExpires: Date | null;
  verificationToken: string | null;
  verificationTokenExpires: Date | null;
  isVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserResponse extends Omit<IUser, "password"> {
  fullName?: string;
}
