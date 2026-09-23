import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, ConnectionMode, useNodesState, useEdgesState, useReactFlow, useNodesInitialized } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../styles/workflow.css';
import '../styles/workflow-shapes.css';
import { CATALOG, CATEGORIES, ANCHORS, newNode, copySelection, pasteSelection, decorateEdge, connectionError, makeEdge, fromGraph, toGraph, validateGraph, arrangeNodes } from '../workflow/model';
import api from '../services/api';

import WorkflowNode, { ShapeGlyph } from './DiagramNode';
let clipboard = { nodes: [], edges: [] };
const nodeTypes = { workflow: WorkflowNode };
const fitOptions = { padding: .12, maxZoom: 1 };

function ReadCanvas({ nodes, edges, activeNodeId, onNodeClick }) {
  const graph = useMemo(() => fromGraph({ nodes, edges }), [nodes, edges]);
  const [measuredNodes, setMeasuredNodes, onMeasure] = useNodesState(graph.nodes);
  useEffect(() => {
    // Sincroniza el grafo recibido del servidor con las mediciones del lienzo.
    // oxlint-disable-next-line react/set-state-in-effect
    setMeasuredNodes(graph.nodes);
  }, [graph.nodes, setMeasuredNodes]);
  const displayNodes = useMemo(() => measuredNodes.map(n => ({ ...n, selected: n.id === activeNodeId })), [measuredNodes, activeNodeId]);
  const { fitView, setCenter, getNode } = useReactFlow();
  const ready = useNodesInitialized();
  useEffect(() => {
    if (!activeNodeId || !ready) return;
    const node = graph.nodes.find(n => n.id === activeNodeId);
    if (!node) return;
    const measured = getNode(activeNodeId)?.measured;
    const frame = requestAnimationFrame(() => setCenter(node.position.x + (measured?.width || 280) / 2, node.position.y + (measured?.height || 150) / 2, { zoom: 1, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450 }));
    return () => cancelAnimationFrame(frame);
  }, [activeNodeId, ready, graph.nodes, setCenter, getNode]);
  return <div className="wf-canvas wf-read-canvas" aria-label="Mapa navegable del flujo"><ReactFlow connectionMode={ConnectionMode.Loose} nodes={displayNodes} onNodesChange={onMeasure} edges={graph.edges} nodeTypes={nodeTypes} colorMode="light" fitView fitViewOptions={fitOptions} minZoom={.1} maxZoom={2} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} onNodeClick={(_, n) => onNodeClick?.(nodes.find(item => String(item.id) === n.id))}><Background variant={BackgroundVariant.Lines} gap={20} color="#e1e6ed" /><Controls showInteractive={false} /><MiniMap pannable zoomable nodeColor="#b4c3d8" /></ReactFlow><button className="wf-fit" onClick={() => fitView({ ...fitOptions, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450 })}>Ver todo</button></div>;
}
export function WorkflowMap(props) { return <ReactFlowProvider><ReadCanvas {...props} /></ReactFlowProvider>; }
function Field({ label, value, onChange, multiline = false, ...props }) {
  return <label className="wf-field"><span>{label}</span>{multiline
    ? <textarea {...props} value={value || ''} onChange={e => onChange(e.target.value)} rows={3} />
    : <input {...props} value={value || ''} onChange={e => onChange(e.target.value)} />}</label>;
}

function Editor({ processes, teamId, initialGraph, onSave, onClose }) {
  const [initial] = useState(() => fromGraph(initialGraph));
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [form, setForm] = useState(initialGraph?.flow || { nombre: '', descripcion: '', processId: processes[0]?.id || '', teamId, version: '1.0' });
  const [selectedId, setSelectedId] = useState(initial.nodes[0]?.id);
  const [edgeId, setEdgeId] = useState(null);
  const [connection, setConnection] = useState({ source: '', target: '', sourceHandle: '', targetHandle: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [closing, setClosing] = useState(false);
  const [panel, setPanel] = useState('nodes');
  const [search, setSearch] = useState('');
  const [lineStyle, setLineStyle] = useState('secuencia');
  const pasteCount = useRef(0);
  const root = useRef(null), canvas = useRef(null);
  const { screenToFlowPosition, fitView, setCenter, getZoom } = useReactFlow();
  const selected = nodes.find(n => n.id === selectedId);
  const selectedEdge = edges.find(e => e.id === edgeId);
  const validation = validateGraph(nodes, edges);
  const requestClose = () => { if (saving) return; if (dirty) setClosing(true); else onClose(); };
  useEffect(() => {
    const previous = document.activeElement;
    root.current?.focus();
    return () => previous?.focus?.();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function changeNode(patch) {
    setNodes(current => current.map(n => n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n));
    setDirty(true);
  }
  function changeMeta(patch) { changeNode({ metadata: { ...selected.data.metadata, ...patch } }); }
  function addNode(tipo, position) {
    const rect = canvas.current.getBoundingClientRect();
    const next = position || screenToFlowPosition({ x: rect.left + rect.width / 2 - 110, y: rect.top + rect.height / 2 - 80 });
    if (!position) {
      while (nodes.some(n => Math.abs(n.position.x - next.x) < 270 && Math.abs(n.position.y - next.y) < 230)) next.y += 260;
    }
    const node = newNode(tipo, next);
    setNodes(current => [...current.map(n => ({ ...n, selected: false })), { ...node, selected: true }]);
    setSelectedId(node.id); setEdgeId(null); setPanel('inspector'); setDirty(true);
    if (!position) setCenter(next.x + 110, next.y + 80, { zoom: getZoom(), duration: 0 });
  }
  function connect(c) {
    const error = connectionError(c, nodes, edges);
    if (error) { setMessage(error); return; }
    setEdges(current => [...current, makeEdge(c, nodes, { data: { tipo: lineStyle, condicion: 'siempre' } })]);
    setDirty(true); setMessage('Conexión añadida.');
  }
  function removeNode() {
    setNodes(current => current.filter(n => n.id !== selectedId));
    setEdges(current => current.filter(e => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null); setDirty(true);
  }
  function copy() {
    const selection = copySelection(nodes, edges);
    if (!selection.nodes.length) { setMessage('Selecciona figuras o conexiones para copiar.'); return; }
    clipboard = selection; pasteCount.current = 0;
    setMessage(`${selection.nodes.length} figuras copiadas con sus conexiones internas.`);
  }
  function paste() {
    if (!clipboard.nodes.length) { setMessage('Primero copia una selección del lienzo.'); return; }
    const added = pasteSelection(clipboard, ++pasteCount.current * 40);
    setNodes(current => [...current.map(n => ({ ...n, selected: false })), ...added.nodes]);
    setEdges(current => [...current.map(e => ({ ...e, selected: false })), ...added.edges]);
    setSelectedId(added.nodes[0].id); setEdgeId(null); setDirty(true);
    canvas.current?.focus({ preventScroll: true });
  }
  function removeSelection() {
    const ids = new Set(nodes.filter(n => n.selected).map(n => n.id));
    if (!ids.size && !edges.some(e => e.selected)) return;
    setNodes(current => current.filter(n => !ids.has(n.id)));
    setEdges(current => current.filter(e => !e.selected && !ids.has(e.source) && !ids.has(e.target)));
    setSelectedId(null); setEdgeId(null); setDirty(true);
  }
  function updateEdge(patch) {
    setEdges(current => current.map(e => e.id === edgeId ? decorateEdge({ ...e, ...patch }) : e)); setDirty(true);
  }
  async function save() {
    if (!form.nombre.trim() || !form.processId) { setMessage('Escribe el nombre del flujo y selecciona un proceso.'); return; }
    if (validation.errors.length) { setMessage(validation.errors.join(' ')); return; }
    setSaving(true); setMessage('');
    try {
      const schema = await api.getSchemaStatus();
      const [major, minor] = String(schema.version || '').split('.').map(Number);
      if (!(major > 1 || (major === 1 && minor >= 3)) || schema.requiereMigracion) {
        throw new Error('Actualiza Code.gs a la versión 1.3.0, ejecuta crearBaseDeDatos() y publica una nueva versión de la implementación. Puedes exportar este diseño mientras tanto.');
      }
      await onSave(toGraph({ ...form, teamId }, nodes, edges));
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }
  function exportDesign() {
    const blob = new Blob([JSON.stringify({ format: 'flowmapper-visual-1', ...toGraph(form, nodes, edges) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${form.nombre || 'flujo'}.json`; link.click(); URL.revokeObjectURL(url);
  }
  function keyDown(event) {
    if (event.key === 'Escape') { event.stopPropagation(); requestClose(); }
    if (!event.target.closest('input, textarea, select, [contenteditable="true"]') && !saving) {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'a'].includes(key)) {
        event.preventDefault(); event.stopPropagation();
        if (key === 'c') copy();
        if (key === 'v') paste();
        if (key === 'a') { setNodes(current => current.map(n => ({ ...n, selected: true }))); setEdges(current => current.map(e => ({ ...e, selected: true }))); }
      }
      if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); removeSelection(); }
    }
    if (event.key !== 'Tab') return;
    const focusable = [...root.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <div ref={root} className="wf-editor" role="dialog" aria-modal="true" aria-label="Constructor visual de flujos" tabIndex={-1} onKeyDown={keyDown}>
    <header className="wf-toolbar"><button onClick={requestClose} disabled={saving} aria-label="Cerrar constructor">←</button><div className="wf-brand"><strong>FlowMapper <span>Studio</span></strong><small>Diseño de flujos · {nodes.length} nodos · {edges.length} conexiones</small></div><div className="wf-toolbar-actions"><button onClick={exportDesign} disabled={saving}>Exportar JSON</button><button className="wf-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : initialGraph ? 'Guardar cambios' : 'Guardar flujo'}</button></div></header>
    <div className="wf-flow-fields"><Field label="Nombre del flujo" value={form.nombre} placeholder="Ej: Atención de Ticket Técnico" onChange={nombre => { setForm({ ...form, nombre }); setDirty(true); }} /><label className="wf-field"><span>Proceso</span><select aria-label="Proceso" disabled={!!initialGraph} value={form.processId} onChange={e => { setForm({ ...form, processId: e.target.value }); setDirty(true); }}>{processes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label><Field label="Descripción del flujo" value={form.descripcion} onChange={descripcion => { setForm({ ...form, descripcion }); setDirty(true); }} /></div>
    {message && <div className="wf-message" role="status"><span>{message}</span><button onClick={() => setMessage('')} aria-label="Ocultar mensaje">×</button></div>}
    {closing && <div className="wf-message" role="alert"><span>Hay cambios sin guardar.</span><button onClick={() => setClosing(false)}>Seguir editando</button><button onClick={onClose}>Descartar y cerrar</button></div>}
    <nav className="wf-mobile-tabs" aria-label="Paneles del constructor">{[['nodes', 'Nodos'], ['canvas', 'Lienzo'], ['inspector', 'Configurar']].map(([id, label]) => <button key={id} className={panel === id ? 'active' : ''} onClick={() => setPanel(id)}>{label}</button>)}</nav>
    <div className="wf-edit-tools"><button onClick={copy}>Copiar</button><button onClick={paste}>Pegar</button><button onClick={removeSelection}>Eliminar selección</button><small>Ctrl / ⌘ C · V · Supr · Mayús + arrastrar para seleccionar</small></div>
    <div className={`wf-workspace show-${panel}`}>
      <aside className="wf-palette"><h2>Formas</h2><p>Arrastra una figura al lienzo o pulsa para añadirla.</p><input aria-label="Buscar tipo de nodo" placeholder="Buscar forma…" value={search} onChange={e => setSearch(e.target.value)} /><div className="wf-catalog">{CATEGORIES.map(category => <details key={category} open><summary>{category}</summary><div className="wf-shape-library">{category === 'Arrows' ? [['secuencia', 'Línea continua'], ['discontinua', 'Línea discontinua']].map(([tipo, label]) => <button key={tipo} draggable aria-pressed={lineStyle === tipo} onDragStart={e => e.dataTransfer.setData('application/flowmapper', 'line:' + tipo)} onClick={() => { setLineStyle(tipo); setMessage(label + ': arrastra entre dos anclajes para conectar.'); }}><span>{tipo === 'secuencia' ? '──→' : '┄┄→'}</span>{label}</button>) : Object.entries(CATALOG).filter(([, cfg]) => cfg.category === category && cfg.label.toLowerCase().includes(search.toLowerCase())).map(([tipo, cfg]) => <button key={tipo} draggable onDragStart={e => { e.dataTransfer.setData('application/flowmapper', tipo); e.dataTransfer.effectAllowed = 'move'; }} onClick={() => addNode(tipo)} aria-label={`Añadir ${cfg.label}`}><ShapeGlyph shape={cfg.shape} />{cfg.label}</button>)}</div></details>)}</div><div className="wf-legend"><p>4 anclajes por figura. Una conexión por lado, hasta cuatro figuras diferentes.</p><p>Para copiar varias figuras: Mayús + clic o arrastra una selección con Mayús. Copiar una conexión incluye sus extremos.</p></div></aside>
      <main className="wf-canvas" ref={canvas} tabIndex={0} aria-label="Lienzo del editor" onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={e => { e.preventDefault(); const tipo = e.dataTransfer.getData('application/flowmapper'); if (tipo.startsWith('line:')) { setLineStyle(tipo.slice(5)); setMessage('Estilo de línea seleccionado. Une dos anclajes.'); } if (CATALOG[tipo]) addNode(tipo, screenToFlowPosition({ x: e.clientX, y: e.clientY })); }}>
        <ReactFlow connectionMode={ConnectionMode.Loose} multiSelectionKeyCode={['Control', 'Meta', 'Shift']} nodes={nodes} edges={edges} nodeTypes={nodeTypes} colorMode="light" fitView fitViewOptions={fitOptions} minZoom={.15} maxZoom={2} snapToGrid snapGrid={[20, 20]} deleteKeyCode={null} onNodesChange={changes => { onNodesChange(changes); if (changes.some(c => c.type === 'position' && c.dragging)) setDirty(true); }} onEdgesChange={onEdgesChange} onConnect={connect} isValidConnection={c => !connectionError(c, nodes, edges)} onNodeClick={(_, n) => { canvas.current?.focus({ preventScroll: true }); setSelectedId(n.id); setEdgeId(null); setPanel('inspector'); }} onEdgeClick={(_, edge) => { canvas.current?.focus({ preventScroll: true }); setEdgeId(edge.id); setSelectedId(null); setPanel('inspector'); }} onPaneClick={() => { canvas.current?.focus({ preventScroll: true }); setSelectedId(null); setEdgeId(null); }}>
          <Background variant={BackgroundVariant.Lines} gap={20} size={1} color="#e1e6ed" /><Controls /><MiniMap pannable zoomable nodeColor={n => CATALOG[n.data.tipo]?.color || '#aaa'} maskColor="rgba(255,255,255,.75)" />
        </ReactFlow><div className="wf-canvas-caption">Arrastra el fondo · Conecta los puertos</div><div className="wf-fit"><button onClick={() => { setNodes(arrangeNodes(nodes, edges)); setDirty(true); }}>Ordenar</button><button onClick={() => fitView({ ...fitOptions, duration: 250 })}>Ver todo</button></div>
      </main>
      <aside className="wf-inspector">
        {selected ? <>
          <h2>{CATALOG[selected.data.tipo]?.icon} Configurar nodo</h2><p>{CATALOG[selected.data.tipo]?.label}</p>
          <Field label="Título del nodo" value={selected.data.titulo} onChange={titulo => changeNode({ titulo })} /><Field label="Descripción del nodo" value={selected.data.descripcion} onChange={descripcion => changeNode({ descripcion })} multiline />
          <label className="wf-field"><span>Forma</span><select value={selected.data.metadata.shape || (['inicio', 'fin'].includes(selected.data.tipo) ? 'oval' : selected.data.tipo === 'decision' ? 'diamond' : selected.data.tipo === 'base-datos' ? 'cylinder' : 'rectangle')} onChange={e => changeMeta({ shape: e.target.value })}><option value="rectangle">Actividad · rectángulo</option><option value="oval">Inicio / fin · óvalo</option><option value="diamond">Decisión · rombo</option><option value="cylinder">Datos · cilindro</option><option value="note">Nota</option><option value="document">Documento</option><option value="subprocess">Subproceso</option><option value="parallelogram">Entrada / salida</option><option value="hexagon">Preparación</option></select></label>
          {selected.data.tipo === 'decision' && <p className="wf-tip">Describe la decisión y asigna Sí, No o una etiqueta a cada conexión desde su inspector.</p>}
          <section className="wf-config-section"><h3>Anclajes</h3><p>Superior · Derecho · Inferior · Izquierdo</p><p>{edges.filter(e => e.source === selectedId || e.target === selectedId).length} de 4 conexiones. Cada lado puede ser origen o destino.</p></section>
          <button className="wf-danger" onClick={removeNode}>Eliminar nodo</button>
        </> : selectedEdge ? <><h2>Conexión</h2><Field label="Etiqueta de conexión" value={selectedEdge.label} onChange={label => updateEdge({ label })} /><label className="wf-field"><span>Estilo de conexión</span><select value={selectedEdge.data.tipo} onChange={e => updateEdge({ data: { ...selectedEdge.data, tipo: e.target.value } })}><option value="secuencia">Continua</option><option value="discontinua">Discontinua</option></select></label><label className="wf-field"><span>Resultado de la decisión</span><select value={selectedEdge.data.condicion} onChange={e => updateEdge({ label: e.target.value === 'positivo' ? 'Sí' : e.target.value === 'negativo' ? 'No' : '', data: { ...selectedEdge.data, condicion: e.target.value } })}><option value="siempre">Siempre</option><option value="positivo">Sí</option><option value="negativo">No</option></select></label><button className="wf-danger" onClick={() => { setEdges(current => current.filter(e => e.id !== edgeId)); setEdgeId(null); setDirty(true); }}>Eliminar conexión</button></> : <><h2>Detalles del diagrama</h2><p>Selecciona una figura o conexión para modificarla.</p></>}
        <section className="wf-config-section"><h3>Conectar nodos</h3><p>También puedes unirlos aquí, sin arrastrar.</p>
          <label className="wf-field"><span>Nodo de origen</span><select value={connection.source} onChange={e => setConnection({ ...connection, source: e.target.value, sourceHandle: 'bottom' })}><option value="" disabled>Seleccionar…</option>{nodes.map(n => <option key={n.id} value={n.id}>{n.data.titulo}</option>)}</select></label>
          <label className="wf-field"><span>Puerto de salida</span><select value={connection.sourceHandle} onChange={e => setConnection({ ...connection, sourceHandle: e.target.value })}><option value="" disabled>Seleccionar…</option>{ANCHORS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <label className="wf-field"><span>Nodo de destino</span><select value={connection.target} onChange={e => setConnection({ ...connection, target: e.target.value, targetHandle: 'top' })}><option value="" disabled>Seleccionar…</option>{nodes.map(n => <option key={n.id} value={n.id}>{n.data.titulo}</option>)}</select></label>
          <label className="wf-field"><span>Puerto de entrada</span><select value={connection.targetHandle} onChange={e => setConnection({ ...connection, targetHandle: e.target.value })}><option value="" disabled>Seleccionar…</option>{ANCHORS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <button onClick={() => connect(connection)}>Añadir conexión</button>
        </section>
        <section className="wf-config-section"><h3>Validación</h3>{!validation.errors.length && !validation.warnings.length && <p className="wf-valid">✓ Estructura válida</p>}{validation.errors.map(error => <p className="wf-error" key={error}>{error}</p>)}{validation.warnings.map(warning => <p className="wf-warning" key={warning}>{warning}</p>)}</section>
      </aside>
    </div>
    <footer className="wf-footer"><span>Diagrama 2D · Diseño y recorrido manual · RF-CFD-001</span><span>{dirty ? 'Cambios sin guardar' : 'Listo para editar'}</span></footer>
    {saving && <div className="wf-saving" role="status">Guardando el flujo…</div>}
  </div>;
}
export default function FlowBuilder(props) {
  return createPortal(<ReactFlowProvider><Editor {...props} /></ReactFlowProvider>, document.body);
}
