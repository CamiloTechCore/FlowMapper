import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FlowBuilder, { WorkflowMap } from '../../components/FlowBuilder';
import { CATALOG } from '../../workflow/model';
import { Badge, Spinner } from '../../components/UI';
import { useData } from '../../context/dataStore';
import { toast } from '../../hooks/useToast';

export default function FlowMapPage({ flow, onBack }) {
  const { fetchFullFlow, nodesForFlow, edgesForFlow, isLoading, flows, teams, processes, saveFullFlow } = useData();
  const [activeId, setActiveId] = useState(null);
  const [walking, setWalking] = useState(false);
  const [path, setPath] = useState([]);
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [triggerId, setTriggerId] = useState('');
  const nodes = nodesForFlow(flow.id), edges = edgesForFlow(flow.id);
  const loading = isLoading('graph_' + flow.id);
  useEffect(() => { fetchFullFlow(flow.id); }, [flow.id, fetchFullFlow]);
  const current = nodes.find(n => n.id === activeId), config = current && CATALOG[current.tipo];
  const outgoing = edges.filter(e => e.sourceId === activeId);
  const triggers = nodes.filter(n => n.tipo === 'inicio');
  function start() {
    const node = triggers.find(n => n.id === triggerId) || triggers[0] || nodes.find(n => !edges.some(e => e.targetId === n.id)) || nodes[0];
    if (!node) { toast.error('El diagrama no tiene figuras. Añádelas desde Editar flujo.'); return; }
    setWalking(true); setPath([node.id]); setIndex(0); setActiveId(node.id);
  }
  function stop() { setWalking(false); setPath([]); setActiveId(null); }
  function follow(edge) {
    if (!nodes.some(n => n.id === edge.targetId)) return;
    if (walking) { const next = [...path.slice(0, index + 1), edge.targetId]; setPath(next); setIndex(next.length - 1); }
    setActiveId(edge.targetId);
  }
  function jump(i) { setIndex(i); setActiveId(path[i]); }
  return <div className="map-page">
    <header className="topbar map-topbar"><div className="map-heading"><button className="btn btn-secondary btn-sm" onClick={onBack}>← Biblioteca</button><div><small>{teams.find(t => t.id === flow.teamId)?.nombre} / {processes.find(p => p.id === flow.processId)?.nombre}</small><h1>{flow.nombre}</h1><p>{nodes.length} nodos · {edges.length} conexiones</p></div></div><div className="topbar-actions"><Badge variant={flow.estado === 'activo' ? 'green' : 'amber'}>{flow.estado}</Badge><button className="btn btn-secondary btn-sm" disabled={loading || !nodes.length} onClick={() => { stop(); setEditing(true); }}>Editar flujo</button>{!walking && triggers.length > 1 && <select className="form-select" aria-label="Activador del recorrido" value={triggerId || triggers[0]?.id} onChange={e => setTriggerId(e.target.value)}>{triggers.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}</select>}{walking ? <button className="btn btn-secondary btn-sm" onClick={stop}>⏹ Detener</button> : <button className="btn btn-primary btn-sm" disabled={loading || !nodes.length} onClick={start}>▶ Recorrer</button>}</div></header>
    <div className="map-workspace">
      <main className="map-canvas-area">{loading && !nodes.length ? <div className="map-loading"><Spinner size={32} /></div> : <WorkflowMap nodes={nodes} edges={edges} activeNodeId={activeId} onNodeClick={node => { if (!walking) setActiveId(node.id); }} />}
        {!nodes.length && !loading && <div className="map-empty"><p>No se pudo cargar el grafo o no tiene nodos.</p><button className="btn btn-secondary" onClick={() => fetchFullFlow(flow.id)}>Volver a cargar</button></div>}
        <div className="map-hint">Arrastra para desplazarte · Rueda para zoom · Selecciona un nodo</div>
        {walking && <nav className="map-history" aria-label="Pasos del recorrido"><button className="btn btn-secondary btn-xs" disabled={index === 0} onClick={() => jump(index - 1)}>← Paso anterior</button><div>{path.map((id, i) => <button key={i} className={i === index ? 'is-current' : ''} aria-label={`Volver al paso ${i + 1}: ${nodes.find(n => n.id === id)?.titulo}`} title={nodes.find(n => n.id === id)?.titulo} onClick={() => jump(i)}>{i + 1}</button>)}</div><span>{index + 1}/{path.length}</span></nav>}
      </main>
      {current && <aside className="map-details" aria-label="Detalle del nodo"><div className="map-details-heading"><span>{config?.icon} {config?.label}</span>{!walking && <button aria-label="Cerrar detalle" onClick={() => setActiveId(null)}>×</button>}</div><h2>{current.titulo}</h2>{current.descripcion && <p>{current.descripcion}</p>}
        {Object.entries(current.metadata?.config || {}).filter(([, value]) => value !== '').map(([key, value]) => <div className="map-property" key={key}><small>{config?.fields.find(([field]) => field === key)?.[1] || key}</small><p>{String(value)}</p></div>)}
        {(current.metadata?.parameters || []).map(p => <div className="map-property" key={p.id}><small>{p.name}</small><p>{p.value}</p></div>)}
        {(current.metadata?.attachments || []).map(p => <div className="map-property" key={p.id}><small>Adjunto · {p.name}</small><p>{p.value}</p></div>)}
        {current.tipo === 'flujo-externo' && flows.some(f => f.id === current.refFlowId) && <Link className="btn btn-secondary btn-sm" to={'/flujos/' + current.refFlowId}>Abrir flujo vinculado →</Link>}
        {current.tipo === 'decision' && <p className="map-decision-note">Evalúa la decisión y elige una de sus rutas.</p>}
        {outgoing.length > 1 && current.tipo !== 'decision' && <p>Bifurcación: explora una rama y vuelve a este paso para recorrer las demás.</p>}
        <div className="map-next-steps">{outgoing.map(edge => <button className={`btn ${edge.condicion === 'positivo' ? 'btn-primary' : edge.condicion === 'negativo' ? 'btn-danger' : 'btn-secondary'}`} key={edge.id} onClick={() => follow(edge)}>{edge.condicion === 'positivo' ? '✓ ' : edge.condicion === 'negativo' ? '✗ ' : '→ '}{edge.etiqueta || (outgoing.length > 1 ? nodes.find(n => n.id === edge.targetId)?.titulo : 'Continuar')}</button>)}</div>
        {!outgoing.length && <p className="map-terminal">✓ Fin del recorrido</p>}
        <footer>Recorrido visual manual</footer>
      </aside>}
    </div>
    {editing && <FlowBuilder processes={processes.filter(p => p.teamId === flow.teamId)} allFlows={flows} teamId={flow.teamId} initialGraph={{ flow, nodes, edges }} onClose={() => setEditing(false)} onSave={async payload => { await saveFullFlow(payload); setEditing(false); setActiveId(null); toast.success('Flujo actualizado en la biblioteca'); }} />}
  </div>;
}
