export const IDLE_DRAFT_MS = 120000;
export const draftKey = (endpoint, teamId, flowId) => `flowmapper:draft:v1:${encodeURIComponent(endpoint)}:${teamId}:${flowId || 'new'}`;
export function draftSnapshot(form, nodes, edges, viewport) {
  return {
    version: 1, form, viewport,
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, target, sourceHandle, targetHandle, label, data }) => ({ id, source, target, sourceHandle, targetHandle, label, data })),
  };
}
export function loadDraft(storage, key) {
  try {
    const draft = JSON.parse(storage.getItem(key));
    if (draft?.version !== 1 || !draft.form || !Array.isArray(draft.nodes) || !Array.isArray(draft.edges)) return null;
    if (draft.nodes.some(n => typeof n.id !== 'string' || !n.data || !Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y))) return null;
    if (draft.edges.some(e => typeof e.id !== 'string' || !e.data || typeof e.source !== 'string' || typeof e.target !== 'string')) return null;
    return draft;
  } catch { return null; }
}
export function writeDraft(storage, key, snapshot) {
  storage.setItem(key, JSON.stringify({ ...snapshot, savedAt: new Date().toISOString() }));
}
