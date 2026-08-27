import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api/client.js';
import UploadPanel from './components/UploadPanel.jsx';
import BatchList from './components/BatchList.jsx';
import CheatingGroups from './components/CheatingGroups.jsx';
import PairsTable from './components/PairsTable.jsx';
import DiffViewer from './components/DiffViewer.jsx';

export default function App() {
  const [batches, setBatches] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeBatch, setActiveBatch] = useState(null);
  const [groups, setGroups] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [tab, setTab] = useState('groups');
  const [selectedPair, setSelectedPair] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const pollRef = useRef(null);

  const refreshList = useCallback(async () => {
    try {
      const list = await api.listBatches();
      setBatches(list);
      setConnectionError(null);
      return list;
    } catch (err) {
      setConnectionError(err.message);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const loadBatch = useCallback(async (id) => {
    try {
      const b = await api.getBatch(id);
      setActiveBatch(b);
      setConnectionError(null);
      if (b.status === 'complete') {
        const [g, p] = await Promise.all([api.getGroups(id), api.getPairs(id)]);
        setGroups(g);
        setPairs(p);
      } else {
        setGroups([]);
        setPairs([]);
      }
      return b;
    } catch (err) {
      setConnectionError(err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setSelectedPair(null);
    loadBatch(activeId);
  }, [activeId, loadBatch]);

  // Poll while the active batch is still processing
  useEffect(() => {
    clearInterval(pollRef.current);
    if (activeBatch?.status === 'processing') {
      pollRef.current = setInterval(async () => {
        const b = await loadBatch(activeId);
        refreshList();
        if (b && b.status !== 'processing') clearInterval(pollRef.current);
      }, 2000);
    }
    return () => clearInterval(pollRef.current);
  }, [activeBatch?.status, activeId, loadBatch, refreshList]);

  async function handleUploaded(batchId) {
    await refreshList();
    setActiveId(batchId);
  }

  return (
    <div className="shell">
      <div className="masthead">
        <div className="masthead__title">
          <span className="dot" />
          Casework
        </div>
        <div className="masthead__sub">AST · Rabin-Karp · LCS · Union-Find</div>
      </div>

      {connectionError && (
        <div className="error-msg" style={{ marginBottom: 20 }}>
          Can't reach the API: {connectionError}. Is the backend running on
          the expected port, and is MongoDB reachable?
        </div>
      )}

      <div className="layout">
        <div>
          <UploadPanel onUploaded={handleUploaded} />
          <div style={{ height: 16 }} />
          <BatchList batches={batches} activeId={activeId} onSelect={setActiveId} />
        </div>

        <div>
          {!activeBatch && (
            <div className="panel">
              <div className="empty-state">
                Select a case on the left, or upload a new batch of submissions to begin.
              </div>
            </div>
          )}

          {activeBatch && activeBatch.status === 'processing' && (
            <div className="panel">
              <div className="empty-state">
                Parsing submissions, hashing structure, scoring pairs… ({activeBatch.name})
              </div>
            </div>
          )}

          {activeBatch && activeBatch.status === 'failed' && (
            <div className="panel">
              <div className="empty-state">Processing failed: {activeBatch.error}</div>
            </div>
          )}

          {activeBatch && activeBatch.status === 'complete' && (
            <>
              <div className="stat-strip">
                <Stat value={activeBatch.submissionCount} label="Submissions" />
                <Stat value={activeBatch.flaggedPairs} label="Flagged pairs" />
                <Stat value={activeBatch.groupCount} label="Cheating rings" />
                <Stat value={`${activeBatch.config?.flagThreshold ?? 60}%`} label="Flag threshold" />
              </div>

              <div className="tabs">
                <div className={`tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>
                  Cheating rings
                </div>
                <div className={`tab ${tab === 'pairs' ? 'active' : ''}`} onClick={() => setTab('pairs')}>
                  All flagged pairs
                </div>
              </div>

              <div className="panel">
                <div className="panel__body">
                  {tab === 'groups' && <CheatingGroups groups={groups} />}
                  {tab === 'pairs' && <PairsTable pairs={pairs} onSelectPair={setSelectedPair} />}
                </div>
              </div>

              {selectedPair && (
                <DiffViewer batchId={activeId} pair={selectedPair} onClose={() => setSelectedPair(null)} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="stat-cell">
      <div className="stat-cell__value">{value}</div>
      <div className="stat-cell__label">{label}</div>
    </div>
  );
}
