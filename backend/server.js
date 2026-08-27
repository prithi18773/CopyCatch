require('dotenv').config();
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const batchRoutes = require('./routes/batches');

const app = express();

connectDB();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/batches', batchRoutes);

// unknown route
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// centralized error handler - multer errors (bad file type, too large),
// Mongoose CastErrors (malformed ids), and anything asyncHandler forwards
// all land here instead of crashing the process.
app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Zip file is too large (150MB limit)' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid id: ${err.value}` });
  }
  if (err.name === 'MongooseServerSelectionError' || err.name === 'MongoNetworkError') {
    return res.status(503).json({ error: 'Could not reach the database. Is MongoDB running?' });
  }

  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Last-resort safety net: log instead of letting one bad promise (e.g. a
// stray DB call outside a route handler) silently kill the whole server.
process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled promise rejection:', err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[server] Autograder API listening on port ${PORT}`));
