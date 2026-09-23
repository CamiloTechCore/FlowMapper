import test from 'node:test';
import assert from 'node:assert/strict';
import { ANCHORS, newNode, makeEdge, fromGraph, toGraph, connectionError, validateGraph, copySelection, pasteSelection } from '../src/workflow/model.js';
import { createBackend, seedHierarchy, graphPayload } from './gas-harness.mjs';

function visualGraph(team, process) { return graphPayload(team, process); }
test('edición conserva IDs, elimina nodos retirados y no duplica flujos', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const saved = backend.request('saveFullFlow', visualGraph(team, process)).data;
  const graph = fromGraph(saved), removed = graph.nodes[3].id;
  const nodes = graph.nodes.filter(n => n.id !== removed), edges = graph.edges.filter(e => e.target !== removed && e.source !== removed);
  nodes[1].data.titulo = 'Decisión actualizada';
  const result = backend.request('saveFullFlow', toGraph({ ...saved.flow, nombre: 'Actualizado' }, nodes, edges));
  assert.equal(result.success, true, result.error);
  assert.equal(backend.request('getAllFlows').data.length, 1);
  assert.equal(result.data.flow.id, saved.flow.id);
  assert.equal(result.data.nodes[1].id, saved.nodes[1].id);
  assert.equal(result.data.edges[0].id, saved.edges[0].id);
  assert.equal(result.data.nodes.some(n => n.id === removed), false);
  const stale = backend.request('saveFullFlow', toGraph(saved.flow, graph.nodes, graph.edges));
  assert.equal(stale.success, false); assert.match(stale.error, /otra sesión/);
});
test('si falla una edición, restaura el grafo anterior y deja intactos los demás', () => {
  for (const table of ['nodos', 'conexiones', 'flujos']) {
    const backend = createBackend(), { team, process } = seedHierarchy(backend);
    const saved = backend.request('saveFullFlow', visualGraph(team, process)).data;
    const other = backend.request('saveFullFlow', graphPayload(team, process)).data;
    const graph = fromGraph(saved); graph.nodes[1].data.titulo = 'No conservar';
    graph.edges[0].label = 'Cambio que debe revertirse';
    backend.failNextWrite(table);
    const result = backend.request('saveFullFlow', toGraph({ ...saved.flow, nombre: 'No conservar' }, graph.nodes, graph.edges));
    assert.equal(result.success, false, table);
    assert.deepEqual(backend.request('getFullFlow', { flowId: saved.flow.id }).data, saved, table);
    assert.deepEqual(backend.request('getFullFlow', { flowId: other.flow.id }).data, other, table);
  }
});

test('cuatro conexiones combinadas: todos los lados pueden enviar y recibir, la quinta se rechaza', () => {
  const nodes = Array.from({ length: 6 }, () => newNode('paso'));
  const edges = ANCHORS.map((p, i) => makeEdge(i % 2 ? { source: nodes[i+1].id, target: nodes[0].id, sourceHandle: 'top', targetHandle: p.id } : { source: nodes[0].id, target: nodes[i+1].id, sourceHandle: p.id, targetHandle: 'top' }, nodes));
  assert.deepEqual(validateGraph(nodes, edges).errors, []);
  const fifth = { source: nodes[0].id, target: nodes[5].id, sourceHandle: 'left', targetHandle: 'top' };
  assert.match(connectionError(fifth, nodes, edges), /Máximo 4/);
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const flow = { nombre: 'Cuatro lados', teamId: team.id, processId: process.id };
  const bad = backend.request('saveFullFlow', toGraph(flow, nodes, [...edges, makeEdge(fifth, nodes)]));
  assert.equal(bad.success, false); assert.match(bad.error, /Máximo 4/);
  assert.equal(backend.request('getAllFlows').data.length, 0);
  const good = backend.request('saveFullFlow', toGraph(flow, nodes, edges));
  assert.equal(good.success, true, good.error);
  const direct = backend.request('createEdge', { flowId: good.data.flow.id, sourceId: good.data.nodes[0].id, targetId: good.data.nodes[5].id, sourceHandle: 'left', targetHandle: 'top' });
  assert.equal(direct.success, false); assert.match(direct.error, /Máximo 4/);
});
test('anclajes ocupados en ambas direcciones, conexiones paralelas y puertos inexistentes se rechazan', () => {
  for (const mutate of [
    p => p.edges.push({ sourceId: '3', targetId: 1, sourceHandle: 'top', targetHandle: 'left' }),
    p => p.edges.push({ sourceId: 'decision-id', targetId: 1, sourceHandle: 'left', targetHandle: 'right' }),
    p => { p.edges[0].sourceHandle = 'extra'; },
    p => { p.edges[0].targetId = p.edges[0].sourceId; },
  ]) {
    const backend = createBackend(), { team, process } = seedHierarchy(backend), payload = graphPayload(team, process);
    mutate(payload);
    assert.equal(backend.request('saveFullFlow', payload).success, false);
    assert.equal(backend.request('getAllFlows').data.length, 0);
  }
});
test('ciclos y líneas discontinuas sobreviven al guardado sin un activador obligatorio', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const nodes = ['documento','decision','base-datos'].map(type => newNode(type));
  const edges = nodes.map((n, i) => makeEdge({ source: n.id, target: nodes[(i+1)%3].id, sourceHandle: 'bottom', targetHandle: 'top' }, nodes, { data: { tipo: i === 1 ? 'discontinua' : 'secuencia', condicion: i === 1 ? 'positivo' : 'siempre' }, label: i === 1 ? 'Sí' : '' }));
  const result = backend.request('saveFullFlow', toGraph({ nombre: 'Ciclo', teamId: team.id, processId: process.id }, nodes, edges));
  assert.equal(result.success, true, result.error);
  const reopened = fromGraph(result.data);
  assert.deepEqual(validateGraph(reopened.nodes, reopened.edges).errors, []);
  assert.equal(reopened.edges[1].style.strokeDasharray, '6 5');
  assert.equal(reopened.edges[1].label, 'Sí');
});
test('portapapeles copia el subgrafo con IDs nuevos, datos independientes y sin enlaces al original', () => {
  const nodes = ['paso','decision','fin'].map(type => ({ ...newNode(type), selected: true }));
  const edge = makeEdge({ source: nodes[0].id, target: nodes[1].id, sourceHandle: 'bottom', targetHandle: 'top' }, nodes);
  const copy = copySelection(nodes, [edge]), pasted = pasteSelection(copy, 80);
  assert.equal(new Set([...nodes, ...pasted.nodes].map(n => n.id)).size, 6);
  assert.equal(pasted.edges.length, 1);
  assert.equal(pasted.edges[0].source, pasted.nodes[0].id);
  assert.equal(pasted.edges[0].target, pasted.nodes[1].id);
  pasted.nodes[0].data.metadata.config.change = true;
  assert.equal(nodes[0].data.metadata.config.change, undefined);
  assert.equal(pasted.nodes[0].position.x, nodes[0].position.x + 80);
  assert.deepEqual(validateGraph(pasted.nodes, pasted.edges).errors, []);
  const edgeOnly = copySelection(nodes.map(n => ({ ...n, selected: false })), [{ ...edge, selected: true }]);
  assert.equal(edgeOnly.nodes.length, 2); assert.equal(edgeOnly.edges.length, 1);
});
test('migración visual conserva conexiones antiguas incluso cuando superan la capacidad', () => {
  const nodes = Array.from({ length: 6 }, (_, i) => ({ id: String(i), tipo: 'ia', titulo: 'Actividad ' + i, metadata: { config: { prompt: 'conservar' } } }));
  const edges = nodes.slice(1).map((n, i) => ({ id: String(i), sourceId: '0', targetId: n.id, sourceHandle: 'out', targetHandle: 'in', tipo: 'modelo' }));
  const graph = fromGraph({ nodes, edges });
  assert.equal(graph.nodes.length, 6); assert.equal(graph.edges.length, 5);
  assert.equal(graph.nodes[0].data.metadata.legacyTipo, 'ia');
  assert.equal(graph.nodes[0].data.metadata.config.prompt, 'conservar');
  assert.match(validateGraph(graph.nodes, graph.edges).errors.join(' '), /Máximo 4/);
});
