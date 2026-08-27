const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Batch = require('../models/Batch');
const Submission = require('../models/Submission');
const SimilarityEdge = require('../models/SimilarityEdge');
const CheatingGroup = require('../models/CheatingGroup');

const { extractZip } = require('../utils/zipExtractor');
const { computeLineDiff } = require('../utils/lineDiff');
const { extractStructuralSequence } = require('../services/astParser');
const UnionFind = require('../services/unionFind');
const WorkerPool = require('../workers/workerPool');
const asyncHandler = require('../utils/asyncHandler');

const K = Number(process.env.AST_KGRAM_SIZE || 6);
const HASH_THRESHOLD = Number(process.env.HASH_CANDIDATE_THRESHOLD || 0.2);
const FLAG_THRESHOLD = Number(process.env.FLAG_SIMILARITY_THRESHOLD || 60);

const workerFile = path.join(__dirname, '..', 'workers', 'compareWorker.js');

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * POST /api/batches/upload
 * Accepts a zip of submissions, responds immediately with a "processing"
 * batch id, then runs the (potentially slow) pipeline asynchronously so the
 * HTTP request doesn't block on hundreds of pairwise comparisons.
 */
exports.uploadBatch = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'A .zip file is required (field name "zipFile")' });
  }

  let batch;
  try {
    batch = await Batch.create({
      name: req.body.name || req.file.originalname,
      status: 'processing',
      config: { kgramSize: K, hashCandidateThreshold: HASH_THRESHOLD, flagThreshold: FLAG_THRESHOLD },
    });
  } catch (err) {
    // Most common cause: MongoDB isn't reachable (not running, wrong MONGO_URI,
    // Atlas IP not whitelisted, etc). Fail this one request instead of taking
    // down the whole process with an unhandled rejection.
    console.error('[upload] failed to create batch record:', err.message);
    fs.unlink(req.file.path, () => {});
    return res.status(503).json({
      error: 'Could not reach the database. Is MongoDB running and is MONGO_URI in backend/.env correct?',
      detail: err.message,
    });
  }

  res.status(202).json({ batchId: batch._id, status: 'processing' });

  processBatch(batch._id, req.file.path).catch(async (err) => {
    console.error(`[batch ${batch._id}] processing failed:`, err);
    try {
      await Batch.findByIdAndUpdate(batch._id, { status: 'failed', error: err.message });
    } catch (innerErr) {
      console.error(`[batch ${batch._id}] could not even record the failure:`, innerErr.message);
    }
  });
});

async function processBatch(batchId, zipPath) {
  // 1. Unzip and group files per student
  const files = extractZip(zipPath);
  if (files.length === 0) {
    throw new Error('No supported source files (.js/.jsx/.ts/.tsx) found in the archive');
  }

  // 2. AST-parse every submission into a structural token sequence
  const submissions = [];
  for (const f of files) {
    const sequence = extractStructuralSequence(f.code);
    const sub = await Submission.create({
      batch: batchId,
      studentName: f.studentName,
      filename: f.filename,
      code: f.code,
      tokenCount: sequence ? sequence.length : 0,
      parseFailed: !sequence,
    });
    if (sequence && sequence.length >= K) {
      submissions.push({ id: sub._id.toString(), sequence });
    }
  }

  // 3. Build every unordered pair - this is the O(n^2) part we must keep cheap per-pair
  const pairs = [];
  for (let i = 0; i < submissions.length; i++) {
    for (let j = i + 1; j < submissions.length; j++) {
      pairs.push({
        idA: submissions[i].id,
        idB: submissions[j].id,
        seqA: submissions[i].sequence,
        seqB: submissions[j].sequence,
      });
    }
  }

  let allResults = [];
  if (pairs.length > 0) {
    // 4. Distribute pairs across worker threads. Each worker runs Rabin-Karp
    //    first (cheap) and only escalates to LCS DP for real candidates.
    const pool = new WorkerPool(workerFile);
    const chunkSize = Math.max(1, Math.ceil(pairs.length / pool.poolSize));
    const chunks = [];
    for (let i = 0; i < pairs.length; i += chunkSize) {
      chunks.push({ pairs: pairs.slice(i, i + chunkSize), K, HASH_THRESHOLD });
    }
    const chunkResults = await pool.runAll(chunks);
    allResults = chunkResults.flat();
  }

  // 5. Persist flagged edges (similarity >= FLAG_THRESHOLD)
  const flaggedEdges = allResults.filter((r) => r.similarity !== null && r.similarity >= FLAG_THRESHOLD);
  if (flaggedEdges.length > 0) {
    await SimilarityEdge.insertMany(
      flaggedEdges.map((r) => ({
        batch: batchId,
        submissionA: r.idA,
        submissionB: r.idB,
        hashJaccard: r.hashJaccard,
        similarity: r.similarity,
      }))
    );
  }

  // 6. Union-Find clustering into cheating rings
  const uf = new UnionFind(submissions.map((s) => s.id));
  for (const e of flaggedEdges) uf.union(e.idA, e.idB);
  const groups = uf.groups();

  if (groups.length > 0) {
    const groupDocs = groups.map((members) => {
      let maxSimilarity = 0;
      for (const e of flaggedEdges) {
        if (members.includes(e.idA) && members.includes(e.idB)) {
          maxSimilarity = Math.max(maxSimilarity, e.similarity);
        }
      }
      return { batch: batchId, members, maxSimilarity };
    });
    await CheatingGroup.insertMany(groupDocs);
  }

  await Batch.findByIdAndUpdate(batchId, {
    status: 'complete',
    submissionCount: submissions.length,
    flaggedPairs: flaggedEdges.length,
    groupCount: groups.length,
  });

  // cleanup the uploaded zip - source is now in Mongo
  fs.unlink(zipPath, () => {});
}

exports.listBatches = asyncHandler(async (req, res) => {
  const batches = await Batch.find().sort({ createdAt: -1 }).limit(50);
  res.json(batches);
});

exports.getBatch = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid batch id' });
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  res.json(batch);
});

exports.getPairs = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid batch id' });
  const edges = await SimilarityEdge.find({ batch: req.params.id })
    .sort({ similarity: -1 })
    .populate('submissionA', 'studentName filename')
    .populate('submissionB', 'studentName filename');
  res.json(edges);
});

exports.getGroups = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid batch id' });
  const groups = await CheatingGroup.find({ batch: req.params.id })
    .sort({ maxSimilarity: -1 })
    .populate('members', 'studentName filename');
  res.json(groups);
});

exports.getSubmissions = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid batch id' });
  const subs = await Submission.find({ batch: req.params.id }, 'studentName filename tokenCount parseFailed');
  res.json(subs);
});

exports.getDiff = asyncHandler(async (req, res) => {
  const { subA, subB } = req.params;
  if (!isValidId(subA) || !isValidId(subB)) {
    return res.status(400).json({ error: 'Invalid submission id' });
  }
  const [a, b] = await Promise.all([Submission.findById(subA), Submission.findById(subB)]);
  if (!a || !b) return res.status(404).json({ error: 'Submission not found' });

  const linesA = a.code.split('\n');
  const linesB = b.code.split('\n');
  const matches = computeLineDiff(linesA, linesB);

  res.json({
    studentA: a.studentName,
    studentB: b.studentName,
    linesA,
    linesB,
    matches, // array of [lineIndexA, lineIndexB] pairs that match
  });
});
