const mongoose = require('mongoose');

// Prevent long buffering timeouts if MongoDB Atlas is unreachable or slow
mongoose.set('bufferTimeoutMS', 2500);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.warn(`⚠️  MongoDB Connection Warning: ${err.message}`);
    console.warn('⚠️  The application requires MongoDB to function. Please check your MONGODB_URI in .env.');
    return null;
  }
};

module.exports = connectDB;
