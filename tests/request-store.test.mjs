import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestStore } from '../src/services/requestStore.js';
const graph = { flow: { id: 'f', actualizadoEn: '1' }, nodes: [{ id: 'n' }], edges: [] };

test('reutiliza confirmación de guardado, comparte lecturas y caduca la caché en 15 segundos', async () => {
  let time = 0, requests = 0;
  const store = createRequestStore(async () => { requests++; return structuredClone(graph); }, { now: () => time });
  await store.call('saveFullFlow', graph);
  const cached = await store.call('getFullFlow', { flowId: 'f' });
  cached.nodes.length = 0;
  assert.equal((await store.call('getFullFlow', { flowId: 'f' })).nodes.length, 1);
  assert.equal(requests, 1);
  time = 15001;
  await Promise.all([store.call('getFullFlow', { flowId: 'f' }), store.call('getFullFlow', { flowId: 'f' })]);
  assert.equal(requests, 2);
});

test('borrar invalida lecturas en vuelo y no resucita un flujo eliminado', async () => {
  let resolveRead, deleted = false, reads = 0;
  const store = createRequestStore(async action => {
    if (action === 'deleteFlow') { deleted = true; return { deleted: 'f' }; }
    reads++;
    if (deleted) throw new Error('Flujo no encontrado');
    return new Promise(resolve => { resolveRead = resolve; });
  });
  const reading = store.call('getFullFlow', { flowId: 'f' });
  await store.call('deleteFlow', { id: 'f' });
  resolveRead(graph);
  await assert.rejects(reading, /no encontrado/);
  assert.equal(reads, 2);
});

test('fallos remotos no se confirman ni se cachean; la biblioteca invalida versiones antiguas', async () => {
  let fail = true, reads = 0;
  const store = createRequestStore(async action => {
    if (action === 'saveFullFlow' && fail) throw new Error('Error remoto');
    if (action === 'getAllFlows') return [{ id: 'f', actualizadoEn: '2' }];
    reads++; return graph;
  });
  await assert.rejects(store.call('saveFullFlow', graph), /Error remoto/);
  fail = false;
  await store.call('getFullFlow', { flowId: 'f' });
  await store.call('getAllFlows');
  await store.call('getFullFlow', { flowId: 'f' });
  assert.equal(reads, 2);
});
