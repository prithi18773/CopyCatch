/**
 * Line-level LCS diff, used only for the human-facing side-by-side diff
 * viewer (as opposed to the token-level LCS in services/similarity.js which
 * drives the actual similarity score). Returns the index pairs of lines that
 * match between the two files so the frontend can highlight them.
 */
function computeLineDiff(linesA, linesB) {
  const n = linesA.length;
  const m = linesB.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const a = linesA[i - 1].trim();
      const b = linesB[j - 1].trim();
      if (a.length > 0 && a === b) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const matches = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const a = linesA[i - 1].trim();
    const b = linesB[j - 1].trim();
    if (a.length > 0 && a === b) {
      matches.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return matches.reverse();
}

module.exports = { computeLineDiff };
