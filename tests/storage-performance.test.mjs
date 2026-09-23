import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, seedHierarchy } from './gas-harness.mjs';

function chain(team, process, size) {
  return {
    flow: { nombre: 'Rendimiento', teamId: team.id, processId: process.id },
    nodes: Array.from({ length: size }, (_, i) => ({ _tempId: String(i), tipo: 'paso', titulo: 'Actividad ' + i })),
    edges: Array.from({ length: size - 1 }, (_, i) => ({ sourceId: String(i), targetId: String(i + 1), sourceHandle: 'bottom', targetHandle: 'top' })),
  };
}

test('100 nodos: operaciones de Sheets por tabla, no por nodo ni por campo', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  backend.resetMetrics();
  const created = backend.request('saveFullFlow', chain(team, process, 100));
  assert.equal(created.success, true, created.error);
  assert.equal(backend.metrics.reads, 5);
  assert.equal(backend.metrics.writes, 3);
  assert.equal(backend.metrics.opens, 1);
  const graph = created.data;
  backend.resetMetrics();
  assert.deepEqual(backend.request('getFullFlow', { flowId: graph.flow.id }).data, graph);
  assert.equal(backend.metrics.reads, 3);
  assert.equal(backend.metrics.opens, 1);
  backend.resetMetrics();
  const edited = backend.request('saveFullFlow', {
    flow: { ...graph.flow, nombre: 'Editado' },
    nodes: graph.nodes.map(node => ({ ...node, _tempId: node.id, titulo: node.titulo + ' editada' })),
    edges: graph.edges.map(edge => ({ ...edge, _tempId: edge.id, etiqueta: 'Continuar' })),
  });
  assert.equal(edited.success, true, edited.error);
  assert.equal(backend.metrics.reads, 3);
  assert.equal(backend.metrics.writes, 3);
  backend.resetMetrics();
  assert.equal(backend.request('deleteFlow', { id: graph.flow.id }).success, true);
  assert.equal(backend.metrics.reads, 3);
  assert.equal(backend.metrics.writes, 3);
  assert.equal(backend.metrics.deletes, 0);
  assert.equal(backend.request('getAllFlows').data.length, 0);
  const sizes = [...backend.tables.values()].map(rows => rows.length);
  assert.equal(backend.request('saveFullFlow', chain(team, process, 100)).success, true);
  assert.deepEqual([...backend.tables.values()].map(rows => rows.length), sizes, 'reutiliza filas vacías sin crecer en cada guardado');
});

test('borrar revierte todas las tablas si falla una escritura; conserva fórmulas extra y otros flujos', () => {
  for (const table of ['flujos', 'nodos', 'conexiones']) {
    const backend = createBackend(), { team, process } = seedHierarchy(backend);
    const graph = backend.request('saveFullFlow', chain(team, process, 4)).data;
    const other = backend.request('saveFullFlow', chain(team, process, 3)).data;
    const rows = backend.tables.get('nodos'); rows.forEach((row, i) => row.push(i === 0 ? 'Formula' : i === 1 ? '=1+2' : ''));
    const before = structuredClone(Object.fromEntries(backend.tables));
    backend.failNextWrite(table);
    const result = backend.request('deleteFlow', { id: graph.flow.id });
    assert.equal(result.success, false, table);
    assert.deepEqual(backend.request('getFullFlow', { flowId: other.flow.id }).data.nodes.map(n => n.id), other.nodes.map(n => n.id));
    assert.deepEqual(Object.fromEntries(backend.tables), before);
  }
});

test('columnas extra intercaladas no se escriben al editar y los huecos no cambian referencias', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const graph = backend.request('saveFullFlow', chain(team, process, 3)).data;
  const rows = backend.tables.get('nodos');
  rows.forEach((row, index) => row.splice(3, 0, index ? '=1+2' : 'Formula'));
  backend.events.length = 0;
  const result = backend.request('saveFullFlow', {
    flow: graph.flow, nodes: graph.nodes.map(n => ({ ...n, _tempId: n.id, titulo: 'Editar' })),
    edges: graph.edges.map(e => ({ ...e, _tempId: e.id })),
  });
  assert.equal(result.success, true, result.error);
  assert.ok(rows.slice(1).every(row => row[3] === '=1+2'));
  assert.ok(backend.events.filter(e => e.type === 'write' && e.name === 'nodos').every(e => e.column > 4 || e.column + e.width <= 4));
});
