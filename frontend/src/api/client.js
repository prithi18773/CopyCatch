const BASE = '/api/batches';

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  uploadBatch: (formData) => fetch(`${BASE}/upload`, { method: 'POST', body: formData }).then(handle),
  listBatches: () => fetch(BASE).then(handle),
  getBatch: (id) => fetch(`${BASE}/${id}`).then(handle),
  getPairs: (id) => fetch(`${BASE}/${id}/pairs`).then(handle),
  getGroups: (id) => fetch(`${BASE}/${id}/groups`).then(handle),
  getDiff: (batchId, subA, subB) => fetch(`${BASE}/${batchId}/diff/${subA}/${subB}`).then(handle),
};
