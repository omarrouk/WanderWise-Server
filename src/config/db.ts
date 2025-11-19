// server/src/config/db.ts
import mongoose from "mongoose";
import chalk from "chalk";

mongoose.set("strictQuery", true);

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error(chalk.red("Missing required env variable: MONGODB_URI"));
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10, // only valid option here
    });

    console.log(
      chalk.green(`MongoDB connected at host: ${conn.connection.host}`)
    );
  } catch (err: any) {
    console.error(chalk.red(`MongoDB connection failed: ${err.message}`));
    throw err;
  }
};

// Mongo connection events
mongoose.connection.on("connected", () => {
  console.log(chalk.blue("Mongoose connected to database"));
});

mongoose.connection.on("error", (err) => {
  console.error(chalk.red(`Mongoose connection error: ${err.message}`));
});

mongoose.connection.on("disconnected", () => {
  console.log(chalk.yellow("Mongoose disconnected from database"));
});

// Graceful shutdown
export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    console.log(chalk.magenta("MongoDB connection closed"));
  } catch (err: any) {
    console.error(
      chalk.red(`Error closing MongoDB connection: ${err.message}`)
    );
    throw err;
  }
};
