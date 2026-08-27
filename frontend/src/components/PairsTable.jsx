export default function PairsTable({ pairs, onSelectPair }) {
  if (pairs.length === 0) {
    return <div className="empty-state">No flagged pairs above the similarity threshold.</div>;
  }

  return (
    <table className="pairs-table">
      <thead>
        <tr>
          <th>Submission A</th>
          <th>Submission B</th>
          <th>Rabin-Karp candidate score</th>
          <th>LCS similarity</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map((p) => (
          <tr key={p._id} className="clickable" onClick={() => onSelectPair(p)}>
            <td>{p.submissionA?.studentName}</td>
            <td>{p.submissionB?.studentName}</td>
            <td>{(p.hashJaccard * 100).toFixed(1)}%</td>
            <td>
              <div className="score-bar-wrap">
                <div className="score-bar">
                  <div className="score-bar__fill" style={{ width: `${Math.min(100, p.similarity)}%` }} />
                </div>
                <span className="score-num">{p.similarity.toFixed(1)}%</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
