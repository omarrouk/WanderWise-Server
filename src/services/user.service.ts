import { User } from "../models/user.model";
import { AppError } from "../middleware/errorMiddleware";

export const getMeService = async (userId: string) => {
  const user = await User.findById(userId).select("-password");
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

  return {
    success: true,
    user,
  };
};

export const deleteMeService = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

  await User.findByIdAndDelete(userId);

  return {
    success: true,
    message: "Account deleted successfully",
  };
};
