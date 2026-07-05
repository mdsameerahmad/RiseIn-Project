import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

export const connectDB = async (retries = 3, delay = 2000): Promise<void> => {
  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in environment variables.');
    throw new Error('MONGODB_URI is missing');
  }

  let currentDelay = delay;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('MongoDB connection established successfully.');
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt} failed. Error:`, error);
      if (attempt === retries) {
        console.error('Max connection retries reached. Failing loudly.');
        throw error;
      }
      console.log(`Retrying connection in ${currentDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= 2; // Exponential backoff
    }
  }
};
