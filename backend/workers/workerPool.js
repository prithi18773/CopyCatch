const { Worker } = require('worker_threads');
const os = require('os');

/**
 * A minimal worker pool that caps concurrency at the number of CPU cores.
 * Each call to runAll() spins up one Worker per queued task (bounded by
 * poolSize running at once) so a batch of, say, 40 comparison chunks on an
 * 8-core box runs 8-at-a-time instead of either serially (slow) or all
 * 40-at-once (thread-spawn overhead + memory blowup).
 */
class WorkerPool {
  constructor(workerFile, poolSize = Math.max(1, os.cpus().length - 1)) {
    this.workerFile = workerFile;
    this.poolSize = poolSize;
  }

  _runTask(data) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.workerFile, { workerData: data });
      worker.once('message', (msg) => {
        resolve(msg);
        worker.terminate();
      });
      worker.once('error', (err) => {
        reject(err);
        worker.terminate();
      });
      worker.once('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
  }

  /** Runs all tasks with at most `poolSize` workers alive concurrently. */
  async runAll(tasks) {
    const results = new Array(tasks.length);
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < tasks.length) {
        const myIndex = nextIndex++;
        results[myIndex] = await this._runTask(tasks[myIndex]);
      }
    };

    const lanes = Array.from({ length: Math.min(this.poolSize, tasks.length) }, () => worker());
    await Promise.all(lanes);
    return results;
  }
}

module.exports = WorkerPool;
