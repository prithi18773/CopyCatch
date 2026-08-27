const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    studentName: { type: String, required: true },
    filename: { type: String, required: true },
    code: { type: String, required: true },
    tokenCount: { type: Number, default: 0 },
    parseFailed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Submission', SubmissionSchema);
