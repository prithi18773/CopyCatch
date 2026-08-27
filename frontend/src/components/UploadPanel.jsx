import { useRef, useState } from 'react';
import { api } from '../api/client.js';

export default function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  function pickFile(f) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setError('Please choose a .zip archive of submissions.');
      return;
    }
    setError(null);
    setFile(f);
    if (!name) setName(f.name.replace(/\.zip$/i, ''));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Select a zip file first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('zipFile', file);
      formData.append('name', name || file.name);
      const { batchId } = await api.uploadBatch(formData);
      onUploaded(batchId);
      setFile(null);
      setName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel__header">New batch</div>
      <div className="panel__body">
        <form onSubmit={handleSubmit}>
          <label
            className={`upload-drop ${dragActive ? 'active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <div className="upload-drop__label">
              Drop submissions.zip here — or click to browse
            </div>
            {file && <div className="upload-drop__filename">{file.name}</div>}
          </label>

          <div className="field">
            <label htmlFor="batch-name">Case label</label>
            <input
              id="batch-name"
              type="text"
              placeholder="e.g. CS201 — Problem Set 4"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Uploading…' : 'Run detection'}
          </button>

          {error && <div className="error-msg">{error}</div>}
        </form>
      </div>
    </div>
  );
}
