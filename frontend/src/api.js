const API_BASE = '/api';

function errorMessage(detail) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg.replace(/^Value error, /, '');
  return 'Request failed';
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    // A 401 on a data request means the session ended; auth endpoints report their own errors.
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new Error(errorMessage(err.detail));
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request('/health'),
  me: () => request('/auth/me'),
  authProviders: () => request('/auth/providers'),
  signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getSavedTracks: () => request('/playlist/saved'),
  saveTrack: (data) => request('/playlist/saved', { method: 'POST', body: JSON.stringify(data) }),
  deleteSavedTrack: (id) => request(`/playlist/saved/${id}`, { method: 'DELETE' }),
  getStats: () => request('/dashboard/stats'),
  getTemplates: (docType) =>
    request(`/templates${docType ? `?doc_type=${docType}` : ''}`),
  getTemplate: (id) => request(`/templates/${id}`),
  getPlaylist: () => request('/playlist/tracks'),
  searchDocuments: (q, docType) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (docType) params.set('doc_type', docType);
    const qs = params.toString();
    return request(`/documents${qs ? `?${qs}` : ''}`);
  },
  getDocuments: (docType) =>
    request(`/documents${docType ? `?doc_type=${docType}` : ''}`),
  getDocument: (id) => request(`/documents/${id}`),
  createDocument: (data) =>
    request('/documents', { method: 'POST', body: JSON.stringify(data) }),
  updateDocument: (id, data) =>
    request(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  duplicateDocument: (id) =>
    request(`/documents/${id}/duplicate`, { method: 'POST' }),
  exportDocument: (id) => `/api/documents/${id}/export`,
  fromTemplate: (templateId, title) =>
    request(
      `/documents/from-template/${templateId}${title ? `?title=${encodeURIComponent(title)}` : ''}`,
      { method: 'POST' }
    ),
  getFinance: (kind) => request(`/finance${kind ? `?kind=${kind}` : ''}`),
  getFinanceSummary: () => request('/finance/summary'),
  createFinance: (data) =>
    request('/finance', { method: 'POST', body: JSON.stringify(data) }),
  updateFinance: (id, data) =>
    request(`/finance/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFinance: (id) => request(`/finance/${id}`, { method: 'DELETE' }),
  getSnippets: () => request('/lab/snippets'),
  getSnippet: (id) => request(`/lab/snippets/${id}`),
  getLabLanguages: () => request('/lab/languages'),
  createSnippet: (data) =>
    request('/lab/snippets', { method: 'POST', body: JSON.stringify(data) }),
  updateSnippet: (id, data) =>
    request(`/lab/snippets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSnippet: (id) => request(`/lab/snippets/${id}`, { method: 'DELETE' }),
  runCode: (data) => request('/lab/run', { method: 'POST', body: JSON.stringify(data) }),
  runSnippet: (id) => request(`/lab/snippets/${id}/run`, { method: 'POST' }),
};
