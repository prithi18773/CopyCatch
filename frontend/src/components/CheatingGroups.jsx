export default function CheatingGroups({ groups }) {
  if (groups.length === 0) {
    return <div className="empty-state">No cheating rings detected in this batch — every submission is structurally distinct.</div>;
  }

  return (
    <div className="corkboard">
      {groups.map((g) => (
        <div className="ring" key={g._id}>
          <div className="ring__label">
            Ring of {g.members.length} · up to {g.maxSimilarity.toFixed(1)}% match
          </div>
          <div className="ring__nodes">
            {g.members.map((m) => (
              <div className="node-card" key={m._id}>
                <div className="node-card__name">{m.studentName}</div>
                <div className="node-card__meta">{m.filename}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
