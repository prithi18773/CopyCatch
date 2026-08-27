#!/usr/bin/env node
/**
 * Zero-dependency tests for the core DSA modules (rolling hash, LCS/edit
 * distance, Union-Find, line diff). These four files have no npm
 * dependencies, so this script runs with plain `node` - no `npm install`
 * required. (astParser.js needs @babel/parser/@babel/traverse and is
 * exercised instead by scripts/smoke-test.sh against a running server.)
 *
 * Usage: node scripts/algorithm-tests.js
 */

const assert = require('assert');
const { generateRollingHashes, jaccardSimilarity, hashToken } = require('../services/rollingHash');
const { lcsLength, editDistance, similarityPercentage } = require('../services/similarity');
const UnionFind = require('../services/unionFind');
const { computeLineDiff } = require('../utils/lineDiff');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    console.error(`FAIL  - ${name}`);
    console.error(`        ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('rollingHash.js (Rabin-Karp)');
test('identical sequences hash to jaccard 1', () => {
  const seq = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const h1 = generateRollingHashes(seq, 3);
  const h2 = generateRollingHashes([...seq], 3);
  assert.strictEqual(jaccardSimilarity(h1, h2), 1);
});
test('disjoint sequences hash to jaccard 0', () => {
  const h1 = generateRollingHashes(['A', 'B', 'C', 'D'], 2);
  const h2 = generateRollingHashes(['W', 'X', 'Y', 'Z'], 2);
  assert.strictEqual(jaccardSimilarity(h1, h2), 0);
});
test('sequence shorter than k produces no hashes', () => {
  assert.deepStrictEqual(generateRollingHashes(['A', 'B'], 5), []);
});
test('rolling hash matches full recompute at every window (no drift)', () => {
  const seq = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const k = 3;
  const rolled = generateRollingHashes(seq, k);
  const BASE = 257n;
  const MOD = 1000000007n;
  for (const { hash, index } of rolled) {
    let expected = 0n;
    for (let i = index; i < index + k; i++) {
      expected = (expected * BASE + BigInt(hashToken(seq[i]))) % MOD;
    }
    assert.strictEqual(hash, expected, `window at index ${index} drifted`);
  }
});

console.log('similarity.js (LCS / edit distance)');
test('LCS of identical sequences equals full length', () => {
  const seq = ['a', 'b', 'c', 'd'];
  assert.strictEqual(lcsLength(seq, [...seq]), 4);
});
test('LCS similarity of identical sequences is 100%', () => {
  const seq = ['x', 'y', 'z'];
  assert.strictEqual(similarityPercentage(seq, [...seq]), 100);
});
test('LCS handles interleaved subsequence correctly', () => {
  // classic example: ABCBDAB vs BDCAB -> LCS length 4 (BCAB or BDAB)
  assert.strictEqual(lcsLength(['A','B','C','B','D','A','B'], ['B','D','C','A','B']), 4);
});
test('edit distance of identical sequences is 0', () => {
  assert.strictEqual(editDistance(['a', 'b', 'c'], ['a', 'b', 'c']), 0);
});
test('edit distance counts single substitution', () => {
  assert.strictEqual(editDistance(['a', 'b', 'c'], ['a', 'x', 'c']), 1);
});
test('similarity of empty sequences is 0, not NaN', () => {
  assert.strictEqual(similarityPercentage([], []), 0);
});

console.log('unionFind.js (Disjoint Set Union)');
test('transitive unions collapse into one group', () => {
  const uf = new UnionFind(['A', 'B', 'C', 'D']);
  uf.union('A', 'B');
  uf.union('B', 'C');
  const groups = uf.groups();
  assert.strictEqual(groups.length, 1);
  assert.deepStrictEqual(new Set(groups[0]), new Set(['A', 'B', 'C']));
});
test('unrelated items never merge', () => {
  const uf = new UnionFind(['A', 'B', 'C', 'D']);
  uf.union('A', 'B');
  uf.union('C', 'D');
  const groups = uf.groups().map((g) => new Set(g));
  assert.strictEqual(groups.length, 2);
});
test('singletons are excluded from groups()', () => {
  const uf = new UnionFind(['A', 'B', 'C']);
  uf.union('A', 'B');
  const groups = uf.groups();
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].includes('C'), false);
});

console.log('lineDiff.js (side-by-side diff)');
test('identical files match every line', () => {
  const lines = ['function f() {', '  return 1;', '}'];
  const matches = computeLineDiff(lines, [...lines]);
  assert.strictEqual(matches.length, 3);
});
test('renamed-but-identical body lines still match', () => {
  const a = ['function add(a, b) {', '  return a + b;', '}'];
  const b = ['function add(x, y) {', '  return a + b;', '}']; // signature differs, body line identical
  const matches = computeLineDiff(a, b);
  assert.ok(matches.some(([i, j]) => i === 1 && j === 1));
});

console.log(`\n${passed} test(s) passed.`);
