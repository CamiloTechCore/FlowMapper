// Caché breve en memoria y lecturas simultáneas compartidas; las escrituras siempre
// esperan confirmación remota. Una mutación invalida también lecturas en curso.
export function createRequestStore(send, { now = Date.now, ttl = 15000 } = {}) {
  const pending = new Map(), graphs = new Map();
  let generation = 0;
  function invalidate() { generation++; pending.clear(); graphs.clear(); }
  function remember(graph) {
    if (!graph?.flow?.id) return;
    graphs.delete(graph.flow.id);
    graphs.set(graph.flow.id, { value: structuredClone(graph), expires: now() + ttl });
    if (graphs.size > 30) graphs.delete(graphs.keys().next().value);
  }
  async function call(action, payload = {}) {
    if (!/^(get|ping)/.test(action)) {
      invalidate();
      try {
        const value = await send(action, payload);
        invalidate();
        if (action === 'saveFullFlow') remember(value);
        return value;
      } catch (error) { invalidate(); throw error; }
    }
    if (action === 'getFullFlow') {
      const saved = graphs.get(payload.flowId);
      if (saved && saved.expires > now()) return structuredClone(saved.value);
      graphs.delete(payload.flowId);
    }
    const key = JSON.stringify([action, payload]), started = generation;
    let promise = pending.get(key);
    if (!promise) {
      promise = (async () => {
        const value = await send(action, payload);
        // Una lectura iniciada antes de guardar/borrar no puede restaurar datos antiguos.
        if (generation !== started) return call(action, payload);
        if (action === 'getFullFlow') remember(value);
        if (action === 'getAllFlows' || action === 'getFlows') {
          const versions = new Map(value.map(flow => [flow.id, flow.actualizadoEn]));
          for (const [id, saved] of graphs) {
            const included = action === 'getAllFlows' || !payload.processId || saved.value.flow.processId === payload.processId;
            if (included && versions.get(id) !== saved.value.flow.actualizadoEn) graphs.delete(id);
          }
        }
        return value;
      })();
      pending.set(key, promise);
    }
    try { return structuredClone(await promise); }
    finally { if (pending.get(key) === promise) pending.delete(key); }
  }
  return { call, invalidate };
}
