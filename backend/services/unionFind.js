/**
 * Disjoint Set Union (Union-Find) with union-by-rank and path compression.
 *
 * Once we have a flat list of flagged pairs ("A~B is 91% similar", "B~C is
 * 84% similar"), a naive reading treats them as isolated facts. Union-Find
 * lets us collapse transitive relationships (A~B, B~C => {A, B, C} is one
 * cheating ring) in near O(1) amortized time per operation, which matters
 * once a batch has dozens of overlapping flagged pairs.
 */
class UnionFind {
  constructor(items = []) {
    this.parent = new Map();
    this.rank = new Map();
    for (const item of items) {
      this.parent.set(item, item);
      this.rank.set(item, 0);
    }
  }

  _ensure(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x) {
    this._ensure(x);
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x))); // path compression
    }
    return this.parent.get(x);
  }

  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX);
    const rankY = this.rank.get(rootY);

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  /** Returns only clusters with 2+ members - i.e. actual cheating rings. */
  groups() {
    const byRoot = new Map();
    for (const item of this.parent.keys()) {
      const root = this.find(item);
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root).push(item);
    }
    return [...byRoot.values()].filter((g) => g.length > 1);
  }
}

module.exports = UnionFind;
