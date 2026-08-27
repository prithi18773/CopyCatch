const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/autograder';

  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected - waiting to reconnect...');
  });

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // fail fast instead of buffering for 10s+ per query
    });
    console.log(`[db] MongoDB connected -> ${uri}`);
  } catch (err) {
    console.error('[db] Could not connect to MongoDB:', err.message);
    console.error('[db] Is mongod running, and does MONGO_URI in backend/.env point at it?');
    process.exit(1);
  }
};
