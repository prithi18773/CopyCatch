const { workerData, parentPort } = require('worker_threads');
const { generateRollingHashes, jaccardSimilarity } = require('../services/rollingHash');
const { similarityPercentage } = require('../services/similarity');

/**
 * Runs inside a Node.js worker_thread. Receives a chunk of submission pairs
 * (token sequences already extracted on the main thread) and, for each pair:
 *   1. Rabin-Karp rolling hash -> cheap Jaccard similarity of k-gram sets.
 *   2. Only if that clears HASH_THRESHOLD, run the expensive LCS-based exact
 *      similarity percentage.
 *
 * Running this in a worker (rather than directly in the Express request
 * handler) keeps the main event loop free to keep serving other HTTP
 * requests while a batch with hundreds of pairwise comparisons is crunching.
 */
const { pairs, K, HASH_THRESHOLD } = workerData;

const results = [];

for (const pair of pairs) {
  const { idA, idB, seqA, seqB } = pair;

  const hashesA = generateRollingHashes(seqA, K);
  const hashesB = generateRollingHashes(seqB, K);
  const hashJaccard = jaccardSimilarity(hashesA, hashesB);

  let similarity = null;
  if (hashJaccard >= HASH_THRESHOLD) {
    similarity = similarityPercentage(seqA, seqB);
  }

  results.push({ idA, idB, hashJaccard, similarity });
}

parentPort.postMessage(results);
