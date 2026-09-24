export const ANCHORS = [
  { id: 'top', label: 'Superior' }, { id: 'right', label: 'Derecho' },
  { id: 'bottom', label: 'Inferior' }, { id: 'left', label: 'Izquierdo' },
];
export const CATALOG = Object.fromEntries([
  ['paso', 'Actividad', 'rectangle', 'General'], ['inicio', 'Inicio', 'oval', 'General'], ['fin', 'Fin', 'oval', 'General'],
  ['texto', 'Texto', 'text', 'General'], ['nota', 'Nota', 'note', 'Misc'], ['documento', 'Documento', 'document', 'Misc'],
  ['subproceso', 'Subproceso', 'subprocess', 'Advanced'], ['base-datos', 'Base de datos', 'cylinder', 'Advanced'],
  ['decision', 'Decisión', 'diamond', 'Flowchart'], ['entrada-salida', 'Entrada / salida', 'parallelogram', 'Flowchart'],
  ['preparacion', 'Preparación', 'hexagon', 'Flowchart'], ['conector', 'Conector', 'oval', 'Flowchart'],
].map(([type, label, shape, category]) => [type, { label, title: label, shape, category, fields: [], icon: shape === 'diamond' ? '◇' : shape === 'oval' ? '○' : '▭', color: '#8798b0' }]));
export const CATEGORIES = ['General', 'Misc', 'Advanced', 'Arrows', 'Flowchart'];
export const uid = () => crypto.randomUUID();
export const shapeOf = node => node.data.metadata?.shape || CATALOG[node.data.tipo]?.shape || 'rectangle';
export function newNode(tipo, position = { x: 100, y: 100 }) {
  return { id: uid(), type: 'workflow', position, data: { tipo: tipo === 'texto' ? 'nota' : tipo, titulo: CATALOG[tipo].title, descripcion: '', metadata: { ...(tipo === 'texto' ? { kind: 'annotation' } : {}), shape: CATALOG[tipo].shape, anchors: ANCHORS.map(p => p.id), config: {} } } };
}
export function anchorUsed(edges, id, port) {
  return edges.some(e => e.source === id && e.sourceHandle === port || e.target === id && e.targetHandle === port);
}
export const connectionLimit = node => ['inicio', 'fin'].includes(node?.data.tipo) ? 1 : 4;
export function connectionError(c, nodes, edges = []) {
  if (!nodes.some(n => n.id === c.source) || !nodes.some(n => n.id === c.target)) return 'Selecciona dos figuras.';
  if (nodes.some(n => [c.source, c.target].includes(n.id) && isAnnotation(n))) return 'Los textos flotantes no admiten conexiones.';
  if (nodes.find(n => n.id === c.source)?.data.tipo === 'decision' && edges.filter(e => e.source === c.source).length >= 2) return 'Una decisión solo permite dos salidas: Sí y No.';
  if (c.source === c.target) return 'Conecta figuras diferentes.';
  if (![c.sourceHandle, c.targetHandle].every(id => ANCHORS.some(p => p.id === id))) return 'Selecciona un anclaje superior, inferior, izquierdo o derecho.';
  for (const id of [c.source, c.target]) {
    const limit = connectionLimit(nodes.find(n => n.id === id));
    if (edges.filter(e => e.source === id || e.target === id).length >= limit) return limit === 1 ? 'Inicio y Fin solo permiten una conexión.' : 'Máximo 4 conexiones por figura, contando entradas y salidas.';
  }
  if (anchorUsed(edges, c.source, c.sourceHandle) || anchorUsed(edges, c.target, c.targetHandle)) return 'Anclaje ocupado: solo se permite una conexión por lado.';
  if (edges.some(e => e.source === c.source && e.target === c.target || e.source === c.target && e.target === c.source)) return 'Ya existe una conexión entre estas figuras.';
  return '';
}
export function decorateEdge(edge) {
  const dashed = edge.data?.tipo === 'discontinua';
  const color = edge.data?.condicion === 'positivo' ? '#45886a' : edge.data?.condicion === 'negativo' ? '#b97580' : '#77879e';
  return { ...edge, type: 'electric', pathOptions: { borderRadius: 8, offset: 35 }, style: { stroke: color, strokeWidth: 1.6, strokeDasharray: dashed ? '6 5' : undefined }, markerEnd: { type: 'arrowclosed', color }, labelStyle: { fill: '#526177', fontSize: 12 }, labelBgStyle: { fill: '#fff' }, labelBgPadding: [6, 4] };
}
export const FLOW_STATES = { borrador: 'Borrador', activo: 'Activo', validacion: 'Validación', desactivado: 'Desactivado' };
export const normalizeStatus = value => Object.hasOwn(FLOW_STATES, value) ? value : value === 'validación' ? 'validacion' : ['inactivo','archivado'].includes(value) ? 'desactivado' : 'borrador';
export const isAnnotation = node => node?.data?.metadata?.kind === 'annotation' || node?.metadata?.kind === 'annotation';
export function descriptionLinks(value) {
  const matches = String(value || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  return [...new Set(matches.map(url => url.replace(/[.,;!?)}\]]+$/, '')).filter(url => {
    try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; }
  }))];
}
export function makeEdge(connection, nodes, extra = {}, existing = []) {
  const decision = nodes.find(n => n.id === connection.source)?.data.tipo === 'decision';
  const condition = decision ? (existing.some(e => e.source === connection.source && e.data.condicion === 'positivo') ? 'negativo' : 'positivo') : 'siempre';
  return decorateEdge({ id: uid(), ...connection, label: '', ...extra, ...(decision ? { label: condition === 'positivo' ? 'Sí' : 'No' } : {}), data: { tipo: 'secuencia', ...extra.data, condicion: condition } });
}
export function normalizeDecisionEdges(nodes, edges) {
  const used = new Map();
  return edges.map(edge => {
    if (nodes.find(n => n.id === edge.source)?.data.tipo !== 'decision') return edge;
    const conditions = used.get(edge.source) || new Set();
    let condition = edge.data.condicion;
    if (!['positivo', 'negativo'].includes(condition) || conditions.has(condition)) condition = conditions.has('positivo') ? 'negativo' : 'positivo';
    conditions.add(condition); used.set(edge.source, conditions);
    return decorateEdge({ ...edge, label: condition === 'positivo' ? 'Sí' : 'No', data: { ...edge.data, condicion: condition } });
  });
}
export function fromGraph(graph) {
  if (!graph) return { nodes: [newNode('inicio')], edges: [] };
  const nodes = graph.nodes.map(n => {
    const meta = n.metadata && typeof n.metadata === 'object' ? n.metadata : {};
    const tipo = CATALOG[n.tipo] ? n.tipo : 'paso';
    const { ports, ...metadata } = meta;
    return { id: String(n.id), type: 'workflow', position: meta.editorPosition || { x: (Number(n.posX) || 0) * 100 + 400, y: -(Number(n.posY) || 0) * 100 + 300 }, data: { tipo, titulo: n.titulo, descripcion: n.descripcion || '', refFlowId: n.refFlowId || '', metadata: { ...(tipo === 'texto' ? { kind: 'annotation' } : {}), shape: CATALOG[tipo].shape, ...metadata, ...(ports ? { legacyPorts: ports } : {}), ...(tipo !== n.tipo ? { legacyTipo: n.tipo } : {}), anchors: ANCHORS.map(p => p.id) } } };
  });
  // Conserva todas las conexiones antiguas. Asigna lados libres sin borrar rutas;
  // si hay más de cuatro, la validación exige corregirlas antes de guardar.
  const used = new Map(nodes.map(n => [n.id, new Set()]));
  const reserve = (id, preferred) => { const occupied = used.get(id) || new Set(); const port = !occupied.has(preferred) ? preferred : ANCHORS.find(p => !occupied.has(p.id))?.id || preferred; occupied.add(port); return port; };
  const isAnchor = value => ANCHORS.some(p => p.id === value);
  // Reserva primero los anclajes explícitos para no desplazar los ya guardados.
  graph.edges.forEach(e => { if (isAnchor(e.sourceHandle)) used.get(String(e.sourceId))?.add(e.sourceHandle); if (isAnchor(e.targetHandle)) used.get(String(e.targetId))?.add(e.targetHandle); });
  const edges = graph.edges.map(e => decorateEdge({ id: String(e.id), source: String(e.sourceId), target: String(e.targetId), sourceHandle: isAnchor(e.sourceHandle) ? e.sourceHandle : reserve(String(e.sourceId), e.condicion === 'positivo' ? 'right' : 'bottom'), targetHandle: isAnchor(e.targetHandle) ? e.targetHandle : reserve(String(e.targetId), 'top'), label: e.etiqueta || '', data: { tipo: ['modelo', 'discontinua'].includes(e.tipo) ? 'discontinua' : 'secuencia', condicion: e.condicion || 'siempre' } }));
  return { nodes, edges: normalizeDecisionEdges(nodes, edges) };
}
export function toGraph(flow, nodes, edges) {
  return { flow, nodes: nodes.map(n => ({ _tempId: n.id, ...n.data, posX: n.position.x / 100, posY: -n.position.y / 100, posZ: 0, metadata: { ...n.data.metadata, editorPosition: n.position, anchors: ANCHORS.map(p => p.id) } })), edges: edges.map(e => ({ _tempId: e.id, sourceId: e.source, targetId: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, tipo: e.data.tipo, condicion: e.data.condicion, etiqueta: e.label || '' })) };
}
export function validateGraph(nodes, edges) {
  const errors = [];
  if (!nodes.length) errors.push('Añade al menos una figura.');
  nodes.forEach(n => { if (!String(n.data.titulo || '').trim()) errors.push('Todas las figuras necesitan un título.'); });
  edges.forEach((e, i) => { const error = connectionError(e, nodes, edges.slice(0, i)); if (error) errors.push(`${nodes.find(n => n.id === e.source)?.data.titulo || '?'} → ${nodes.find(n => n.id === e.target)?.data.titulo || '?'}: ${error}`); });
  nodes.filter(n => n.data.tipo === 'decision').forEach(n => { const branches = edges.filter(e => e.source === n.id).map(e => e.data.condicion); if (branches.some(c => !['positivo','negativo'].includes(c)) || new Set(branches).size !== branches.length) errors.push(`Revisa las salidas Sí / No de ${n.data.titulo}.`); });
  return { errors: [...new Set(errors)], warnings: [] };
}
export function arrangeNodes(nodes, edges) {
  const roots = nodes.filter(n => n.data.tipo === 'inicio' || !edges.some(e => e.target === n.id));
  const levels = new Map((roots.length ? roots : nodes.slice(0, 1)).map(n => [n.id, 0]));
  const queue = [...levels.keys()];
  for (let i = 0; i < queue.length; i++) edges.filter(e => e.source === queue[i]).forEach(e => { if (!levels.has(e.target)) { levels.set(e.target, levels.get(queue[i]) + 1); queue.push(e.target); } });
  const columns = new Map(), heights = new Map(), rows = new Map();
  nodes.forEach(n => { const level = levels.get(n.id) || 0; heights.set(level, Math.max(heights.get(level) || 0, n.measured?.height || 200)); });
  let y = 0;
  [...heights.keys()].sort((a, b) => a - b).forEach(level => { rows.set(level, y); y += heights.get(level) + 120; });
  return nodes.map(n => { const level = levels.get(n.id) || 0, column = columns.get(level) || 0; columns.set(level, column + 1); return { ...n, position: { x: column * 410, y: rows.get(level) } }; });
}
export function copySelection(nodes, edges) {
  const endpoints = new Set(edges.filter(e => e.selected).flatMap(e => [e.source, e.target]));
  const selected = nodes.filter(n => n.selected || endpoints.has(n.id));
  const ids = new Set(selected.map(n => n.id));
  return structuredClone({ nodes: selected.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })), edges: edges.filter(e => ids.has(e.source) && ids.has(e.target)) });
}
export function pasteSelection(clipboard, offset = 40) {
  const copy = structuredClone(clipboard), ids = new Map(copy.nodes.map(n => [n.id, uid()]));
  return { nodes: copy.nodes.map(n => ({ ...n, id: ids.get(n.id), selected: true, position: { x: n.position.x + offset, y: n.position.y + offset } })), edges: copy.edges.map(e => decorateEdge({ ...e, id: uid(), selected: true, source: ids.get(e.source), target: ids.get(e.target) })) };
}
