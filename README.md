# Casework — Autograder & Plagiarism Detection Engine

A MERN application that ingests a zip of student code submissions, detects
structural code similarity immune to variable renaming/reformatting, and
groups likely copiers into cheating rings — without brute-forcing every
pairwise comparison on the main Node event loop.

**Stack:** MongoDB (Mongoose) · Express · React (Vite) · Node.js

## How a submission is scored

```
zip upload
   │
   ▼
unzip (adm-zip) ─── one logical submission per student folder/file
   │
   ▼
AST parse (@babel/parser + @babel/traverse)
   │   source code -> sequence of structural node-type tokens
   │   ("ForStatement", "BinaryExpression:<", ...) — renaming variables
   │   or reformatting whitespace does not change this sequence.
   ▼
Rabin-Karp rolling hash (per submission, O(N))
   │   k-gram fingerprints of the token sequence, compared pairwise via
   │   Jaccard similarity — cheap enough to run on every pair.
   ▼
   ├── below candidate threshold ──> discarded, no further work done
   │
   ▼ above candidate threshold
LCS-based similarity (dynamic programming)
   │   exact "Submission A is 85% similar to Submission B" score,
   │   only computed for the small subset of real candidates.
   ▼
Union-Find (Disjoint Set Union)
   │   collapses transitive flagged pairs (A~B, B~C) into cheating rings
   ▼
MongoDB — Batch / Submission / SimilarityEdge / CheatingGroup
   ▼
React dashboard — cheating-ring corkboard, sortable pairs table,
   line-level diff viewer
```

The O(n²) pairwise comparison is the expensive part once a batch has
hundreds of submissions (n=300 → ~45,000 pairs). Two things keep the server
responsive:

1. **Rabin-Karp is the first pass, LCS is the second.** Every pair pays only
   for O(N) rolling-hash fingerprinting; the O(N·M) LCS/DP comparison only
   runs on pairs that already look suspicious.
2. **`worker_threads`.** Pairwise comparison work is chunked and spread
   across a pool of workers (`backend/workers/`), so this CPU-bound work
   never blocks the Express event loop from serving other requests while a
   batch is crunching.

## Project layout

```
backend/
  server.js                 Express app entry
  config/db.js               Mongoose connection (fail-fast + reconnect logging)
  models/                    Batch, Submission, SimilarityEdge, CheatingGroup (Mongoose schemas)
  middleware/upload.js        Multer config (zip only, 150MB cap)
  controllers/batchController.js   Orchestrates the full pipeline
  services/
    astParser.js              AST -> structural token sequence
    rollingHash.js             Rabin-Karp rolling hash + Jaccard
    similarity.js              LCS length / edit distance / % similarity
    unionFind.js                Disjoint Set Union
  workers/
    compareWorker.js            worker_thread entry: hash + LCS per pair
    workerPool.js                distributes chunks across CPU cores
  utils/
    zipExtractor.js             unzips + groups files per student
    lineDiff.js                  line-level LCS diff for the UI
    asyncHandler.js              forwards async route errors to Express
  scripts/
    algorithm-tests.js           zero-dependency unit tests
    smoke-test.sh                 curl-driven end-to-end API test

frontend/
  src/App.jsx                 top-level layout, polling, state, error banner
  src/components/
    UploadPanel.jsx             drag/drop zip upload
    BatchList.jsx                sidebar of past batches
    CheatingGroups.jsx           corkboard cluster visualization
    PairsTable.jsx                sortable table of flagged pairs
    DiffViewer.jsx                 side-by-side highlighted diff
  src/api/client.js             fetch wrapper

setup.sh                    one-time setup: .env + npm install x3
package.json                 root - `npm run dev` starts both servers together
```

## Setup

Requires **Node.js 18+** and a **MongoDB** instance — either installed
locally, or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
cluster. Get Mongo running and reachable *first*; everything else depends
on it.

### Install MongoDB locally (skip if using Atlas)

macOS:
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

Windows / Linux: follow the official install guide at
https://www.mongodb.com/docs/manual/administration/install-community/,
then start the `mongod` service.

Either way, confirm it's actually reachable before moving on:
```bash
mongosh mongodb://localhost:27017
```
If that hangs or errors, fix it here before continuing — nothing above the
database layer will work otherwise.

### Install and run the app

```bash
./setup.sh       # creates backend/.env, npm installs root + backend + frontend
npm run dev      # starts the API (port 5000) and the dashboard (port 5173) together
```

Open **http://localhost:5173**.

If you'd rather not use the root scripts, run each side manually in two
terminals:

```bash
# terminal 1
cd backend
cp .env.example .env      # point MONGO_URI at your database if not localhost
npm install
npm run test                # zero-dependency algorithm tests, no DB needed
npm run dev                  # http://localhost:5000

# terminal 2
cd frontend
npm install
npm run dev                  # http://localhost:5173 (proxies /api to :5000)
```

### Try it

Drag a `.zip` of submissions into the dashboard, or drive the API directly
with the included sample data:

```bash
cd backend
npm run smoke-test ../sample-submissions.zip
```

A submissions zip should contain either:

- one folder per student (`alice/solution.js`, `bob/solution.js`, ...), or
- one flat file per student (`alice.js`, `bob.js`, ...)

Supported extensions: `.js`, `.jsx`, `.ts`, `.tsx`.

## Troubleshooting

**`MongooseError: Operation buffering timed out` / server crashes on upload**
MongoDB isn't reachable. Confirm with `mongosh mongodb://localhost:27017`
(or your Atlas URI) - if that doesn't connect cleanly, nothing else will
work. See "Install MongoDB locally" above, or double check `MONGO_URI` in
`backend/.env` if you're using Atlas (and that your current IP is
whitelisted in Atlas's network access settings).

With the fixes in this build, a DB outage during upload now returns a clean
`503 { error: "Could not reach the database..." }` instead of taking the
whole server down - so if you still see a crash, the fastest way to isolate
it is `npm run test` inside `backend/` (no DB required) passing while the
server itself won't start or upload still fails.

**`Only .zip archives are accepted` / 400 on upload**
The multer file filter only accepts `.zip`. Make sure the form field name is
`zipFile` (the frontend already sends this).

**Nothing happens after upload / batch stuck on "processing"**
Check the backend terminal - `processBatch` records failures (`status:
'failed'`) instead of hanging silently. A batch with zero
`.js/.jsx/.ts/.tsx` files, or a zip whose files all fail to parse, will fail
fast with a message explaining why.

**Frontend loads but shows "Can't reach the API"**
The dashboard surfaces backend/network failures directly instead of failing
silently. Confirm the backend is actually up: `curl
http://localhost:5000/api/health` should return `{"ok":true}`.

**Port already in use**
Something else is already on 5000 or 5173. Change `PORT` in `backend/.env`,
and/or `server.port` in `frontend/vite.config.js` (update the proxy target
to match if you change the backend port).

**`npm run dev` at the root doesn't work**
That command needs `concurrently`, installed by `./setup.sh` (or `npm
install` at the repo root). If you skipped setup.sh, run `npm install` in
the root folder once, then `npm run dev` again.

## Tuning

Environment variables in `backend/.env` (see `.env.example`):

| Variable | Meaning |
|---|---|
| `MONGO_URI` | Mongoose connection string |
| `AST_KGRAM_SIZE` | Rabin-Karp window size over the AST token sequence |
| `HASH_CANDIDATE_THRESHOLD` | Jaccard score above which a pair is escalated to LCS |
| `FLAG_SIMILARITY_THRESHOLD` | LCS similarity % above which a pair is stored/flagged |

## Notes on scope

This implementation targets JavaScript/TypeScript submissions (Babel's
parser). To support other languages (Python, Java, C++) for a hackathon
judging use case, swap `services/astParser.js` for a language-appropriate
parser — the Rabin-Karp, LCS, and Union-Find stages are language-agnostic
since they only ever see the flattened token sequence.
