const mongoose = require('mongoose');

const CheatingGroupSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true }],
    // highest pairwise similarity found inside this cluster, useful for sorting by severity
    maxSimilarity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CheatingGroup', CheatingGroupSchema);
