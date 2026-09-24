import test from 'node:test';
import assert from 'node:assert/strict';
import { newNode, makeEdge, connectionError, validateGraph, fromGraph, toGraph } from '../src/workflow/model.js';
import { createBackend, seedHierarchy } from './gas-harness.mjs';

test('Inicio y Fin aceptan una conexión total y rechazan otra en ambos sentidos, también en servidor', () => {
  for (const type of ['inicio', 'fin']) {
    const nodes = [newNode(type), newNode('paso'), newNode('paso')];
    const first = makeEdge({ source: nodes[0].id, target: nodes[1].id, sourceHandle: 'bottom', targetHandle: 'top' }, nodes);
    for (const reverse of [false, true]) {
      const second = makeEdge({ source: nodes[reverse ? 2 : 0].id, target: nodes[reverse ? 0 : 2].id, sourceHandle: 'right', targetHandle: 'left' }, nodes);
      assert.deepEqual(validateGraph(nodes, [first]).errors, []);
      assert.match(connectionError(second, nodes, [first]), /una conexión/);
      const backend = createBackend(), { team, process } = seedHierarchy(backend);
      const flow = { nombre: 'Terminal', teamId: team.id, processId: process.id };
      const invalid = backend.request('saveFullFlow', toGraph(flow, nodes, [first, second]));
      assert.equal(invalid.success, false); assert.match(invalid.error, /una conexión/);
      assert.equal(backend.request('getAllFlows').data.length, 0);
      const valid = backend.request('saveFullFlow', toGraph(flow, nodes, [first]));
      assert.equal(valid.success, true, valid.error);
      const direct = backend.request('createEdge', { flowId: valid.data.flow.id, sourceId: valid.data.nodes[reverse ? 2 : 0].id, targetId: valid.data.nodes[reverse ? 0 : 2].id, sourceHandle: 'right', targetHandle: 'left' });
      assert.equal(direct.success, false); assert.match(direct.error, /una conexión/);
      // Existing diagrams are still loaded intact and report the new capacity rule.
      const legacy = fromGraph({ nodes: nodes.map(n => ({ id: n.id, ...n.data })), edges: toGraph(flow, nodes, [first, second]).edges.map((e, i) => ({ ...e, id: String(i) })) });
      assert.equal(legacy.edges.length, 2);
      assert.match(validateGraph(legacy.nodes, legacy.edges).errors.join(' '), /una conexión/);
    }
  }
});
