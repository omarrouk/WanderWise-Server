import { Request, Response, NextFunction } from "express";
import chalk from "chalk";

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFound = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  next(new AppError(`Not Found - ${req.originalUrl}`, 404, "NOT_FOUND"));
};

// Handle specific error types
const handleMongooseError = (err: any): AppError => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    const value = err.keyValue?.[field];
    return new AppError(
      `${field} '${value}' already exists`,
      400,
      "DUPLICATE_KEY"
    );
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors)
      .map((e: any) => e.message)
      .join(", ");
    return new AppError(messages, 400, "VALIDATION_ERROR");
  }

  if (err.name === "CastError") {
    return new AppError(`Invalid ${err.path}: ${err.value}`, 400, "INVALID_ID");
  }

  return err;
};

const handleJWTError = (err: any): AppError => {
  if (err.name === "JsonWebTokenError") {
    return new AppError(
      "Invalid token. Please login again",
      401,
      "JWT_INVALID"
    );
  }
  if (err.name === "TokenExpiredError") {
    return new AppError(
      "Token expired. Please login again",
      401,
      "JWT_EXPIRED"
    );
  }
  return err;
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error: AppError;

  if (err instanceof AppError) {
    error = err;
  } else if (err instanceof Error) {
    error = new AppError(err.message, 500, "INTERNAL_ERROR");
  } else {
    error = new AppError("Unknown error", 500, "UNKNOWN_ERROR");
  }

  // Enhance with specific handlers
  error = handleMongooseError(error);
  error = handleJWTError(error);

  // Handle JSON syntax errors
  if (err instanceof SyntaxError && "body" in (err as any)) {
    error = new AppError("Invalid JSON format", 400, "SYNTAX_ERROR");
  }

  // Handle Prisma errors
  if ((err as any).code === "P2002") {
    const field = (err as any).meta?.target?.[0] || "field";
    error = new AppError(`${field} already exists`, 400, "DUPLICATE_FIELD");
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";
  const code = error.code || "INTERNAL_ERROR";

  // Logging
  if (process.env.NODE_ENV === "development") {
    console.error(chalk.red("Error:"), err);
  } else {
    console.error(
      chalk.red(`${err instanceof Error ? err.name : "Error"}: ${message}`)
    );
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(process.env.NODE_ENV === "development" && {
        stack: (err as any).stack,
        details: err,
      }),
    },
  });
};

// Async handler wrapper
export const asyncHandler =
  <T>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
