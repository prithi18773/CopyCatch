/**
 * Exact similarity scoring via dynamic programming.
 *
 * This is intentionally only called on the small subset of pairs that
 * already passed the Rabin-Karp candidate filter - full O(n*m) DP over
 * every pair of hundreds of submissions would be the "brute force that
 * crashes your Node server" the assignment warns about.
 */

/**
 * Longest Common Subsequence length between two token sequences, computed
 * with a space-optimized DP (O(n*m) time, O(m) space instead of O(n*m)).
 */
function lcsLength(a, b) {
  const n = a.length;
  const m = b.length;
  let prev = new Array(m + 1).fill(0);
  let curr = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev[m];
}

/**
 * Levenshtein (edit) distance between two token sequences, space-optimized
 * to two rolling rows, O(n*m) time / O(m) space.
 */
function editDistance(a, b) {
  const n = a.length;
  const m = b.length;
  let prev = new Array(m + 1).fill(0).map((_, j) => j);
  let curr = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

/**
 * Converts LCS overlap into a 0-100 similarity percentage, normalized
 * against the longer of the two sequences so padding one file with unrelated
 * code doesn't artificially inflate the score.
 */
function similarityPercentage(seqA, seqB) {
  const maxLen = Math.max(seqA.length, seqB.length);
  if (maxLen === 0) return 0;
  const lcs = lcsLength(seqA, seqB);
  return (lcs / maxLen) * 100;
}

module.exports = { lcsLength, editDistance, similarityPercentage };
