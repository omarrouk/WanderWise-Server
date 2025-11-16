import * as dotenv from "dotenv";
import { Server } from "http";
import chalk from "chalk";
import app from "./app";
import { connectDB, disconnectDB } from "./config/db";

dotenv.config();

// Validate required environment variables
const requiredEnv = ["MONGODB_URI"];
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.error(chalk.red(`Missing required env variable: ${key}`));
    process.exit(1);
  }
});

const PORT = process.env.PORT || 5000;
let server: Server | undefined;

// Start server
const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    console.log(chalk.green("Database connected"));

    server = app.listen(PORT, () => {
      console.log(chalk.green(`Server running at http://localhost:${PORT}`));
    });
  } catch (error: any) {
    console.error(chalk.red(`Failed to start server: ${error.message}`));
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(chalk.yellow(`${signal} received. Shutting down gracefully...`));

  if (server) {
    server.close(async () => {
      console.log(chalk.blue("HTTP server closed"));
      await disconnectDB();
      console.log(chalk.magenta("Database disconnected"));
      console.log(chalk.cyan("Shutdown complete"));
      process.exit(0);
    });
  } else {
    await disconnectDB();
    console.log(chalk.magenta("Database disconnected (no active server)"));
    console.log(chalk.cyan("Shutdown complete"));
    process.exit(0);
  }
};

// Handle process signals
["SIGTERM", "SIGINT"].forEach((sig) =>
  process.on(sig, () => gracefulShutdown(sig))
);

// Handle unhandled errors
process.on("unhandledRejection", (reason: any) => {
  console.error(chalk.red("Unhandled Rejection:"), reason);
  gracefulShutdown("Unhandled Rejection");
});

process.on("uncaughtException", (error: Error) => {
  console.error(chalk.red("Uncaught Exception:"), error);
  process.exit(1);
});

// Start the application
startServer();
