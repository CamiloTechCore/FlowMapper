import test from 'node:test';
import assert from 'node:assert/strict';
import { newNode, makeEdge, defaultPorts, fromGraph, toGraph, connectionError, validateGraph, arrangeNodes } from '../src/workflow/model.js';
import { createBackend, seedHierarchy, graphPayload } from './gas-harness.mjs';

export function visualGraph(team, process) {
  const nodes = ['inicio', 'decision', 'ia', 'notificacion', 'modelo-ia', 'transformacion'].map((type, i) => newNode(type, { x: i * 200, y: i * 80 }));
  nodes[3].data.metadata.ports.inputs.push({ id: 'attachment-in', label: 'Adjunto', kind: 'secuencia' });
  nodes[3].data.metadata.attachments = [{ id: 'file', name: 'informe.html', value: '{{html}}' }];
  nodes[1].data.metadata.config = { campo: '{{count}}', operador: 'mayor que', valor: '3' };
  const edge = (a, b, sourceHandle = 'out', targetHandle = 'in') => makeEdge({ source: nodes[a].id, target: nodes[b].id, sourceHandle, targetHandle }, nodes);
  const edges = [edge(0, 1), edge(1, 2, 'positivo'), edge(1, 5, 'negativo'), edge(5, 1), edge(2, 3), edge(2, 5), edge(4, 2, 'model-out', 'model-in'), edge(5, 3, 'out', 'attachment-in')];
  return toGraph({ nombre: 'Flujo visual', teamId: team.id, processId: process.id }, nodes, edges);
}
test('guardar decisiones, splits, ciclos, modelos y puertos dinámicos conserva su semántica', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const payload = visualGraph(team, process), result = backend.request('saveFullFlow', payload);
  assert.equal(result.success, true, result.error);
  const saved = backend.request('getFullFlow', { flowId: result.data.flow.id }).data;
  const graph = fromGraph(saved);
  assert.deepEqual(validateGraph(graph.nodes, graph.edges), { errors: [], warnings: [] });
  assert.equal(saved.edges.filter(e => e.tipo === 'modelo').length, 1);
  assert.equal(saved.edges.find(e => e.targetHandle === 'attachment-in').tipo, 'secuencia');
  assert.deepEqual(saved.nodes[3].metadata.attachments, payload.nodes[3].metadata.attachments);
  assert.deepEqual(saved.nodes[1].metadata.config, payload.nodes[1].metadata.config);
  assert.deepEqual(graph.nodes[2].position, { x: 400, y: 160 });
  assert.equal(graph.edges.find(e => e.data.tipo === 'modelo').style.strokeDasharray, '6 6');
  assert.equal(arrangeNodes(graph.nodes, graph.edges).length, graph.nodes.length);
});
test('edición conserva IDs, elimina nodos retirados y no duplica flujos', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const saved = backend.request('saveFullFlow', visualGraph(team, process)).data;
  const graph = fromGraph(saved), removed = graph.nodes[3].id;
  const nodes = graph.nodes.filter(n => n.id !== removed), edges = graph.edges.filter(e => e.target !== removed);
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
    backend.failNextWrite(table);
    const result = backend.request('saveFullFlow', toGraph({ ...saved.flow, nombre: 'No conservar' }, graph.nodes, graph.edges));
    assert.equal(result.success, false, table);
    assert.deepEqual(backend.request('getFullFlow', { flowId: saved.flow.id }).data, saved, table);
    assert.deepEqual(backend.request('getFullFlow', { flowId: other.flow.id }).data, other, table);
  }
});
test('rechaza dependencias incorrectas, decisiones incompletas, puertos inexistentes y duplicados antes de escribir', () => {
  const mutations = [
    p => { p.edges[0].tipo = 'modelo'; },
    p => { p.edges[0].targetHandle = 'missing'; },
    p => { p.edges = p.edges.filter(e => e.condicion !== 'negativo'); },
    p => { p.edges.push({ ...p.edges[0] }); },
    p => { p.nodes[0].metadata.ports.outputs.push({ ...p.nodes[0].metadata.ports.outputs[0] }); },
    p => { p.edges[1].condicion = 'siempre'; },
  ];
  for (const mutate of mutations) {
    const backend = createBackend(), { team, process } = seedHierarchy(backend), payload = visualGraph(team, process);
    mutate(payload);
    assert.equal(backend.request('saveFullFlow', payload).success, false);
    assert.equal(backend.request('getAllFlows').data.length, 0);
  }
});
test('editor distingue puertos de modelo, permite retornos y advierte nodos desconectados', () => {
  const nodes = ['inicio', 'decision', 'ia', 'modelo-ia'].map(type => newNode(type));
  assert.match(connectionError({ source: nodes[3].id, target: nodes[2].id, sourceHandle: 'model-out', targetHandle: 'in' }, nodes), /datos/);
  assert.equal(connectionError({ source: nodes[2].id, target: nodes[1].id, sourceHandle: 'out', targetHandle: 'in' }, nodes), '');
  const result = validateGraph(nodes, []);
  assert.equal(result.errors.length, 2); assert.equal(result.warnings.length, 3);
  assert.deepEqual(defaultPorts('decision').outputs.map(p => p.id), ['positivo', 'negativo']);
});
test('grafos antiguos se abren con formas y puertos predeterminados', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const saved = backend.request('saveFullFlow', graphPayload(team, process)).data;
  saved.edges.forEach(e => { delete e.tipo; delete e.sourceHandle; delete e.targetHandle; });
  const graph = fromGraph(saved);
  assert.equal(graph.edges[1].sourceHandle, 'positivo');
  assert.deepEqual(validateGraph(graph.nodes, graph.edges).errors, []);
});
