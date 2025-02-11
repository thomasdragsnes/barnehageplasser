// config/database.js
const mongoose = require('mongoose');

let isConnected = false;

async function connectDB(uri) {
  if (isConnected) {
    console.log('Using existing database connection');
    return;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    throw error;
  }
}

async function disconnectDB() {
  if (!isConnected) {
    return;
  }
  
  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB Disconnected');
  } catch (error) {
    console.error('MongoDB Disconnection Error:', error);
    throw error;
  }
}

async function clearDB() {
  if (!isConnected) {
    return;
  }

  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  clearDB
};