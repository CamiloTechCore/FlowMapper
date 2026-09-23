import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, seedHierarchy, graphPayload } from './gas-harness.mjs';

test('setup preserva registros existentes y ping devuelve el contrato esperado', () => {
  const backend = createBackend(); seedHierarchy(backend);
  assert.equal(backend.request('setup').success, true);
  assert.equal(backend.request('getTeams').data.length, 1);
  assert.equal(backend.request('ping').data.pong, true);
});
test('guardar y recuperar un grafo traduce IDs temporales y conserva ramas distintas', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const saved = backend.request('saveFullFlow', graphPayload(team, process));
  assert.equal(saved.success, true, saved.error);
  const graph = backend.request('getFullFlow', { flowId: saved.data.flow.id }).data;
  assert.equal(graph.nodes.length, 4); assert.equal(graph.edges.length, 4);
  for (const edge of graph.edges) {
    assert.ok(graph.nodes.some(n => n.id === edge.sourceId));
    assert.ok(graph.nodes.some(n => n.id === edge.targetId));
  }
  assert.notEqual(graph.edges[1].targetId, graph.edges[2].targetId);
});
test('un grafo inválido se rechaza antes de crear el flujo', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const payload = graphPayload(team, process); payload.edges[0].targetId = 'missing';
  assert.equal(backend.request('saveFullFlow', payload).success, false);
  assert.equal(backend.request('getAllFlows').data.length, 0);
});
test('un fallo durante el guardado revierte flujo, nodos y conexiones', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  backend.failNextWrite('conexiones');
  assert.equal(backend.request('saveFullFlow', graphPayload(team, process)).success, false);
  const stats = backend.request('getStats').data;
  assert.equal(stats.flows, 0); assert.equal(stats.nodes, 0); assert.equal(stats.edges, 0);
});
test('no permite borrar padres con hijos y elimina el grafo junto al flujo', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const graph = backend.request('saveFullFlow', graphPayload(team, process)).data;
  assert.equal(backend.request('deleteTeam', { id: team.id }).success, false);
  assert.equal(backend.request('deleteProcess', { id: process.id }).success, false);
  assert.equal(backend.request('deleteFlow', { id: graph.flow.id }).success, true);
  assert.equal(backend.request('getStats').data.nodes, 0);
  assert.equal(backend.request('getStats').data.edges, 0);
  assert.equal(backend.request('deleteProcess', { id: process.id }).success, true);
  assert.equal(backend.request('deleteTeam', { id: team.id }).success, true);
});
test('rechaza referencias de otro equipo y conexiones de otro flujo', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const otherTeam = backend.request('createTeam', { nombre: 'Otro' }).data;
  assert.equal(backend.request('createFlow', { teamId: otherTeam.id, processId: process.id }).success, false);
  const first = backend.request('saveFullFlow', graphPayload(team, process)).data;
  const second = backend.request('saveFullFlow', graphPayload(team, process)).data;
  assert.equal(backend.request('createEdge', { flowId: first.flow.id, sourceId: first.nodes[0].id, targetId: second.nodes[1].id }).success, false);
});
test('actualizar coordenadas acepta cero y borrar nodo limpia sus conexiones', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const graph = backend.request('saveFullFlow', graphPayload(team, process)).data;
  assert.equal(backend.request('updateNode', { id: graph.nodes[0].id, posX: 0 }).data.posX, 0);
  backend.request('deleteNode', { id: graph.nodes[1].id });
  assert.equal(backend.request('getEdges', { flowId: graph.flow.id }).data.length, 1);
});
test('GET no modifica hojas y acciones heredadas no son invocables', () => {
  const backend = createBackend();
  assert.equal(backend.request('createTeam', { nombre: 'No crear' }, 'GET').success, false);
  assert.equal(backend.request('constructor').success, false);
  assert.equal(backend.request('getTeams').data.length, 0);
});
