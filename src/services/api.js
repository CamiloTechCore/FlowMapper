// ─────────────────────────────────────────────────────────────────
//  api.js  —  Capa de acceso al backend Google Apps Script
//  Lee VITE_GAS_URL (o VITE_API_URL) del .env de Vite
// ─────────────────────────────────────────────────────────────────

import { GAS_URL as BASE_URL } from './config';
import { createRequestStore } from './requestStore';

if (!BASE_URL) {
  console.warn(
    '[FlowMapper] VITE_GAS_URL no definido.\n' +
    'Copia .env.example → .env y agrega la URL del WebApp desplegado.'
  );
}

/**
 * Llamada genérica al WebApp de GAS.
 * GET  → lecturas  (get*, ping, getStats)
 * POST → escrituras (create*, update*, delete*, batch*)
 * Nota: GAS requiere Content-Type: text/plain para doPost
 */
async function send(action, payload = {}) {
  if (!BASE_URL) {
    throw new Error(
      'VITE_GAS_URL no configurado. Revisa tu archivo .env'
    );
  }

  const isRead = /^(get|ping|getStats)/.test(action);

  let response;
  try {
    if (isRead) {
      const qs = new URLSearchParams({ action, ...payload });
      response = await fetch(`${BASE_URL}?${qs}`, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      });
    } else {
      response = await fetch(BASE_URL, {
        method: 'POST',
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, ...payload }),
      });
    }
  } catch (err) {
    throw new Error(`Error de red: ${err.message}`);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status} — ${response.statusText}`);

  let json;
  try { json = await response.json(); }
  catch { throw new Error('GAS no devolvió JSON. Revisa la URL /exec y los permisos de la implementación.'); }
  if (!json.success) throw new Error(json.error || json.message || 'Error desconocido del servidor GAS');
  return json.data;
}

const { call } = createRequestStore(send);
let compatibility;
function ensureCompatible() {
  if (!compatibility) {
    compatibility = call('ping').then(info => {
      const [major, minor] = String(info.version || '').split('.').map(Number);
      if (!(major > 1 || (major === 1 && minor >= 3))) {
        throw new Error('Actualiza Code.gs a la versión 1.3.0 o posterior y publica una nueva versión de la implementación. Puedes exportar este diseño mientras tanto.');
      }
    }).catch(error => { compatibility = null; throw error; });
  }
  return compatibility;
}

// ── API pública ──────────────────────────────────────────────────
const api = {
  ensureCompatible,
  // Sistema
  ping:             ()               => call('ping'),
  setup:            ()               => call('setup'),
  saveFullFlow:     (data)           => call('saveFullFlow', data),
  getSchemaStatus:  ()               => call('getSchemaStatus'),
  getStats:         ()               => call('getStats'),

  // Equipos
  getTeams:         ()               => call('getTeams'),
  createTeam:       (d)              => call('createTeam',     d),
  updateTeam:       (d)              => call('updateTeam',     d),
  deleteTeam:       (id)             => call('deleteTeam',     { id }),

  // Procesos
  getProcesses:     (teamId)         => call('getProcesses',   { teamId }),
  getAllProcesses:   ()               => call('getAllProcesses'),
  createProcess:    (d)              => call('createProcess',  d),
  updateProcess:    (d)              => call('updateProcess',  d),
  deleteProcess:    (id)             => call('deleteProcess',  { id }),

  // Flujos
  getFlows:         (processId)      => call('getFlows',       { processId }),
  getAllFlows:       ()               => call('getAllFlows'),
  createFlow:       (d)              => call('createFlow',     d),
  updateFlow:       (d)              => call('updateFlow',     d),
  deleteFlow:       (id)             => call('deleteFlow',     { id }),

  // Nodos
  getNodes:         (flowId)         => call('getNodes',       { flowId }),
  createNode:       (d)              => call('createNode',     d),
  updateNode:       (d)              => call('updateNode',     d),
  deleteNode:       (id)             => call('deleteNode',     { id }),
  batchCreateNodes: (flowId, nodes)  => call('batchCreateNodes', { flowId, nodes }),

  // Conexiones
  getEdges:         (flowId)         => call('getEdges',       { flowId }),
  createEdge:       (d)              => call('createEdge',     d),
  deleteEdge:       (id)             => call('deleteEdge',     { id }),
  batchCreateEdges: (flowId, edges)  => call('batchCreateEdges', { flowId, edges }),

  // Grafo completo en una sola llamada
  getFullFlow:      (flowId)         => call('getFullFlow',    { flowId }),
};

export default api;
