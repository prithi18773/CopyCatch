export default function BatchList({ batches, activeId, onSelect }) {
  return (
    <div className="panel">
      <div className="panel__header">
        <span>Cases on file</span>
        <span>{batches.length}</span>
      </div>
      <div>
        {batches.length === 0 && <div className="empty-state">No batches yet</div>}
        {batches.map((b) => (
          <div
            key={b._id}
            className={`batch-row ${b._id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(b._id)}
          >
            <span className="batch-row__name">{b.name}</span>
            <span className={`status-chip ${b.status}`}>{b.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
