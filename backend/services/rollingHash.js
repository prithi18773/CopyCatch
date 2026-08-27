/**
 * Rabin-Karp rolling hash over an AST token sequence.
 *
 * Comparing every pair of submissions with a full O(n*m) LCS/edit-distance
 * pass is far too expensive once you have hundreds of files (that's up to
 * ~50,000 pairs, each potentially thousands of tokens long). Instead we
 * first fingerprint every submission with cheap rolling k-gram hashes in
 * O(N) time, then only pay for the exact DP comparison (services/similarity.js)
 * on pairs whose fingerprint sets already overlap heavily.
 */

const BASE = 257n;
const MOD = 1000000007n;

/** djb2-style hash of a token string down to a 32-bit int. */
function hashToken(token) {
  let h = 5381;
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) + h + token.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Generates rolling hashes for every k-gram window in the token sequence
 * using the classic Rabin-Karp technique: the hash for window i+1 is derived
 * from the hash for window i in O(1), instead of recomputing from scratch,
 * giving O(N) total time to hash all windows of a sequence of length N.
 *
 * @param {string[]} sequence AST token sequence
 * @param {number} k window size (k-gram length)
 * @returns {{hash: bigint, index: number}[]}
 */
function generateRollingHashes(sequence, k) {
  const hashes = [];
  const n = sequence.length;
  if (n < k) return hashes;

  const power = modPow(BASE, BigInt(k - 1), MOD);

  let h = 0n;
  for (let i = 0; i < k; i++) {
    h = (h * BASE + BigInt(hashToken(sequence[i]))) % MOD;
  }
  hashes.push({ hash: h, index: 0 });

  for (let i = 1; i <= n - k; i++) {
    const outgoing = BigInt(hashToken(sequence[i - 1]));
    const incoming = BigInt(hashToken(sequence[i + k - 1]));
    h = (h + MOD - (outgoing * power) % MOD) % MOD; // remove outgoing token
    h = (h * BASE + incoming) % MOD; // shift and add incoming token
    hashes.push({ hash: h, index: i });
  }

  return hashes;
}

function modPow(base, exp, mod) {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

/**
 * Jaccard similarity between two sets of k-gram fingerprints: how much of
 * their combined structural "vocabulary" of k-grams do they share. This is
 * the fast candidate filter - cheap to compute, and a strong signal that two
 * files share large identical blocks of logic even after cosmetic edits.
 */
function jaccardSimilarity(hashesA, hashesB) {
  if (hashesA.length === 0 || hashesB.length === 0) return 0;

  const setA = new Set(hashesA.map((h) => h.hash));
  const setB = new Set(hashesB.map((h) => h.hash));

  let intersection = 0;
  for (const h of setA) {
    if (setB.has(h)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

module.exports = { generateRollingHashes, jaccardSimilarity, hashToken };
