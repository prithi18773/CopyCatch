import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function DiffViewer({ batchId, pair, onClose }) {
  const [diff, setDiff] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pair) return;
    setDiff(null);
    setError(null);
    api
      .getDiff(batchId, pair.submissionA._id, pair.submissionB._id)
      .then(setDiff)
      .catch((err) => setError(err.message));
  }, [batchId, pair]);

  if (!pair) return null;

  const matchedA = new Set((diff?.matches || []).map((m) => m[0]));
  const matchedB = new Set((diff?.matches || []).map((m) => m[1]));

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div className="panel__header">
        <span>
          Diff · {pair.submissionA.studentName} vs {pair.submissionB.studentName} · {pair.similarity.toFixed(1)}% match
        </span>
        <button className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
      {error && <div className="empty-state">{error}</div>}
      {!diff && !error && <div className="empty-state">Loading diff…</div>}
      {diff && (
        <div className="diff-viewer" style={{ maxHeight: 480, overflowY: 'auto' }}>
          <DiffColumn title={diff.studentA} lines={diff.linesA} matched={matchedA} />
          <DiffColumn title={diff.studentB} lines={diff.linesB} matched={matchedB} />
        </div>
      )}
    </div>
  );
}

function DiffColumn({ title, lines, matched }) {
  return (
    <div className="diff-col">
      <div className="diff-col__head">{title}</div>
      {lines.map((line, i) => (
        <div className={`diff-line ${matched.has(i) ? 'matched' : ''}`} key={i}>
          <span className="diff-line__num">{i + 1}</span>
          <span className="diff-line__code">{line || ' '}</span>
        </div>
      ))}
    </div>
  );
}
