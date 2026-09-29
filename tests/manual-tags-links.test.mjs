import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, seedHierarchy } from './gas-harness.mjs';
import { normalizeTeamTag, matchesFlowSearch } from '../src/workflow/tags.js';
import { nodeUrl } from '../src/workflow/links.js';

test('etiquetas editables persisten sin cambiar esquema ni crear backups; cambios inválidos revierten', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const columns = [...backend.tables.get('equipos')[0]];
  backend.events.length = 0;
  let response = backend.request('updateTeam', { id: team.id, etiqueta: '#{Soporte}' });
  assert.equal(response.success, true, response.error);
  assert.equal(response.data.etiqueta, '#Soporte');
  assert.equal(backend.request('getTeams').data[0].etiqueta, '#Soporte');
  assert.equal(backend.request('updateTeam', { id: team.id, nombre: 'Soporte técnico' }).data.etiqueta, '#Soporte');
  response = backend.request('updateTeam', { id: team.id, nombre: 'No guardar', etiqueta: '#dos etiquetas' });
  assert.equal(response.success, false);
  assert.equal(backend.request('getTeams').data[0].nombre, 'Soporte técnico');
  assert.equal(backend.request('getTeams').data[0].etiqueta, '#Soporte');
  backend.failNextWrite('meta');
  assert.equal(backend.request('updateTeam', { id: team.id, nombre: 'Tampoco guardar', etiqueta: '#Nuevo' }).success, false);
  assert.equal(backend.request('getTeams').data[0].nombre, 'Soporte técnico');
  assert.equal(backend.request('getTeams').data[0].etiqueta, '#Soporte');
  assert.deepEqual(backend.tables.get('equipos')[0], columns);
  assert.equal(backend.events.some(e => e.type === 'backup'), false);
  assert.equal(backend.request('updateTeam', { id: team.id, etiqueta: '' }).data.etiqueta, '');
  assert.equal(backend.request('getTeams').data[0].etiqueta, '');
  const other = backend.request('createTeam', { nombre: 'Nuevo', etiqueta: '#QA' }).data;
  assert.equal(other.etiqueta, '#QA');
  assert.equal(backend.request('deleteTeam', { id: other.id }).success, true);
  assert.equal(backend.request('getData', { sheet: 'meta' }).data.some(r => r.clave === 'teamTag:' + other.id), false);
  assert.equal(backend.request('getProcesses', { teamId: team.id }).data[0].id, process.id);
});

test('búsqueda combina etiqueta exacta heredada y texto sin distinguir mayúsculas', () => {
  assert.equal(normalizeTeamTag(' #{Atención_QA} '), '#Atención_QA');
  assert.throws(() => normalizeTeamTag('#con espacio'));
  assert.throws(() => normalizeTeamTag('x'.repeat(49)));
  const flow = { nombre: 'Resolver ticket' }, team = { nombre: 'Equipo', etiqueta: '#Soporte' }, process = { nombre: 'Auditoría' };
  assert.equal(matchesFlowSearch(flow, team, process, '#SOPORTE ticket'), true);
  assert.equal(matchesFlowSearch(flow, team, process, '#Soporte2'), false);
  assert.equal(matchesFlowSearch(flow, { ...team, etiqueta: '#QA' }, process, '#Soporte'), false);
  assert.equal(matchesFlowSearch(flow, { ...team, etiqueta: '#QA' }, process, '#QA auditoría'), true);
  assert.equal(matchesFlowSearch(flow, team, process, ''), true);
  const url = new URL(nodeUrl('https://example.com', 'flow / uno', 'nodo?á#1'));
  assert.equal(url.pathname, '/flujos/flow%20%2F%20uno');
  assert.equal(url.searchParams.get('nodo'), 'nodo?á#1');
});

test('151 conexiones: guardar avances conserva IDs, sobreescribe y no crea backups', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const payload = {
    flow: { nombre: 'Flujo grande', teamId: team.id, processId: process.id },
    nodes: Array.from({ length: 152 }, (_, i) => ({ _tempId: String(i), tipo: 'paso', titulo: 'Actividad ' + i })),
    edges: Array.from({ length: 151 }, (_, i) => ({ sourceId: String(i), targetId: String(i + 1), sourceHandle: 'bottom', targetHandle: 'top' })),
  };
  backend.failNextCopy();
  backend.events.length = 0;
  const first = backend.request('saveFullFlow', payload);
  assert.equal(first.success, true, first.error);
  let graph = first.data;
  const ids = graph.nodes.map(n => n.id), edgeIds = graph.edges.map(e => e.id);
  for (let round = 0; round < 3; round++) {
    backend.resetMetrics();
    const saved = backend.request('saveFullFlow', {
      flow: graph.flow,
      nodes: graph.nodes.map(n => ({ ...n, _tempId: n.id, titulo: 'Avance ' + round + ' ' + n.id })),
      edges: graph.edges.map(e => ({ ...e, _tempId: e.id, etiqueta: 'Paso ' + round })),
    });
    assert.equal(saved.success, true, saved.error);
    graph = saved.data;
    assert.deepEqual(graph.nodes.map(n => n.id), ids);
    assert.deepEqual(graph.edges.map(e => e.id), edgeIds);
    assert.equal(backend.metrics.writes, 3);
  }
  assert.equal(backend.request('getAllFlows').data.length, 1);
  assert.deepEqual(backend.request('getFullFlow', { flowId: graph.flow.id }).data, graph);
  assert.equal(backend.events.some(e => e.type === 'backup'), false);
});

test('reintento del mismo guardado tras perder la respuesta devuelve el flujo sin duplicarlo', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const payload = {
    flow: { nombre: 'Reintento', teamId: team.id, processId: process.id, saveRequestId: 'request-one' },
    nodes: [{ _tempId: 'new', tipo: 'paso', titulo: 'Inicio del trabajo' }], edges: [],
  };
  const first = backend.request('saveFullFlow', payload);
  assert.equal(first.success, true, first.error);
  backend.resetMetrics();
  assert.deepEqual(backend.request('saveFullFlow', payload).data, first.data);
  assert.equal(backend.metrics.writes, 0);
  assert.equal(backend.request('getAllFlows').data.length, 1);
  const edit = { flow: { ...first.data.flow, saveRequestId: 'request-two' }, nodes: first.data.nodes.map(n => ({ ...n, _tempId: n.id, titulo: 'Actualizado' })), edges: [] };
  const updated = backend.request('saveFullFlow', edit);
  assert.equal(updated.success, true, updated.error);
  assert.deepEqual(backend.request('saveFullFlow', edit).data, updated.data);
  assert.equal(backend.request('saveFullFlow', payload).success, false, 'un reintento antiguo no sobrescribe cambios posteriores');
  assert.equal(backend.request('getFullFlow', { flowId: first.data.flow.id }).data.nodes[0].titulo, 'Actualizado');
});
