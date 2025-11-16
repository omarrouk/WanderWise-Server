import mongoose from "mongoose";
import chalk from "chalk";

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error(chalk.red("Missing required env variable: MONGODB_URI"));
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true, 
      maxPoolSize: 10, 
      serverSelectionTimeoutMS: 5000, 
    });

    console.log(
      chalk.green(`MongoDB connected at host: ${conn.connection.host}`)
    );
  } catch (error: any) {
    console.error(chalk.red(`MongoDB connection failed: ${error.message}`));

    // Optional retry logic (useful in production)
    setTimeout(connectDB, 5000);
  }
};

// Register connection events once
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
  } catch (error: any) {
    console.error(
      chalk.red(`Error closing MongoDB connection: ${error.message}`)
    );
    throw error;
  }
};
