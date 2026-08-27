const mongoose = require('mongoose');

const SimilarityEdgeSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    submissionA: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
    submissionB: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
    // fast Rabin-Karp k-gram Jaccard score used to flag candidates
    hashJaccard: { type: Number, required: true },
    // exact LCS-based similarity percentage, only computed for candidates that clear hashJaccard
    similarity: { type: Number, required: true },
  },
  { timestamps: true }
);

SimilarityEdgeSchema.index({ batch: 1, similarity: -1 });

module.exports = mongoose.model('SimilarityEdge', SimilarityEdgeSchema);
