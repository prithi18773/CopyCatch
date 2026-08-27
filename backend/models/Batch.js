const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ['processing', 'complete', 'failed'],
      default: 'processing',
    },
    error: { type: String },
    submissionCount: { type: Number, default: 0 },
    flaggedPairs: { type: Number, default: 0 },
    groupCount: { type: Number, default: 0 },
    // config snapshot so results are reproducible even if defaults change later
    config: {
      kgramSize: Number,
      hashCandidateThreshold: Number,
      flagThreshold: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Batch', BatchSchema);
