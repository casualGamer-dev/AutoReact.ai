const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set (see .env.example)');
  await mongoose.connect(uri);
  console.log('MongoDB Atlas connected');
}

module.exports = { connectDB };
