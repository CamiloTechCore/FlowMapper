import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ReactFlow, Background, Controls, MiniMap, Position } from '@xyflow/react';
import { useData } from '../../context/dataStore';
import api from '../../services/api';
import { electricEdgeTypes } from '../../components/edgeTypes';
import '../../styles/canvas-effects.css';
import { FLOW_STATES, normalizeStatus } from '../../workflow/model';
import '../../styles/team-overview.css';

export default function TeamOverviewPage() {
  const { teams, flows, processes } = useData();
  const [params, setParams] = useSearchParams();
  const teamId = params.get('equipo') || teams[0]?.id || '';
  const [result, setResult] = useState({ graphs: [], errors: [], loading: true });
  const [revision, setRevision] = useState(0);
  const teamFlows = useMemo(() => flows.filter(f => f.teamId === teamId), [flows, teamId]);
  const requestKey = JSON.stringify(teamFlows.map(f => [f.id, f.actualizadoEn]));
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setResult({ graphs: [], errors: [], loading: true });
      const ids = JSON.parse(requestKey).map(([id]) => id), graphs = [], errors = [];
      for (let i = 0; i < ids.length; i += 4) {
        if (cancelled) return;
        const batch = ids.slice(i, i + 4);
        const responses = await Promise.allSettled(batch.map(id => api.getFullFlow(id)));
        responses.forEach((response, index) => {
          if (response.status === 'fulfilled') graphs.push(response.value);
          else errors.push({ id: batch[index], message: response.reason.message });
        });
      }
      if (!cancelled) setResult({ graphs, errors, loading: false });
    }
    load();
    return () => { cancelled = true; };
  }, [requestKey, revision]);
  const graph = useMemo(() => {
    const groups = [...new Set(teamFlows.map(f => f.processId))], rows = new Map();
    const nodes = teamFlows.map(flow => {
      const row = rows.get(flow.processId) || 0; rows.set(flow.processId, row + 1);
      return {
        id: flow.id, position: { x: groups.indexOf(flow.processId) * 360, y: row * 210 },
        sourcePosition: Position.Right, targetPosition: Position.Left,
        style: { width: 260, borderRadius: 12, borderColor: '#cbd7e7', background: '#fff', padding: 18 },
        data: { label: <div className="overview-flow"><small>{processes.find(p => p.id === flow.processId)?.nombre || 'Proceso'}</small><strong>{flow.nombre}</strong><span>{FLOW_STATES[normalizeStatus(flow.estado)]}</span><Link to={'/flujos/' + flow.id}>Abrir flujo →</Link></div> },
      };
    });
    const ids = new Set(nodes.map(n => n.id));
    const edges = result.graphs.flatMap(item => item.nodes.filter(n => n.refFlowId && ids.has(n.refFlowId)).map(n => ({
      id: item.flow.id + ':' + n.id, source: item.flow.id, target: n.refFlowId,
      type: 'electric', label: n.titulo, markerEnd: { type: 'arrowclosed', color: '#7995bd' },
      style: { stroke: '#7995bd', strokeWidth: 1.7 }, labelStyle: { fontSize: 11 },
    })));
    return { nodes, edges };
  }, [teamFlows, processes, result.graphs]);
  return <div className="team-overview">
    <header className="topbar"><div><h1>Vista general</h1><p>Flujos conectados entre los procesos del equipo</p></div><div className="topbar-actions"><label>Equipo<select aria-label="Equipo del mapa" className="form-select" value={teamId} onChange={e => setParams({ equipo: e.target.value })}>{teams.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label><button className="btn btn-secondary" disabled={result.loading} onClick={() => setRevision(r => r + 1)}>Actualizar mapa</button><Link className="btn btn-secondary" to={'/?equipo=' + teamId}>Biblioteca</Link></div></header>
    <div className="overview-status" role="status">{result.loading ? 'Cargando conexiones…' : `${graph.nodes.length} flujos · ${graph.edges.length} vínculos dentro del equipo`}</div>
    {result.errors.length > 0 && <div role="alert" className="connection-notice">Mapa incompleto: {result.errors.map(e => `${teamFlows.find(f => f.id === e.id)?.nombre || e.id}: ${e.message}`).join('; ')}. Puedes reintentar con Actualizar mapa.</div>}
    <main className="overview-canvas" aria-label="Mapa de flujos del equipo">
      {!teamFlows.length ? <p className="overview-empty">Este equipo todavía no tiene flujos.</p> : result.loading ? <p className="overview-empty">Cargando el mapa del equipo…</p> : <ReactFlow key={teamId + revision + requestKey} nodes={graph.nodes} edges={graph.edges} edgeTypes={electricEdgeTypes} fitView fitViewOptions={{ padding: .25, maxZoom: 1 }} minZoom={.15} maxZoom={2} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} colorMode="light"><Background gap={24} color="#dde5ef" /><Controls showInteractive={false} /><MiniMap pannable zoomable /></ReactFlow>}
    </main>
  </div>;
}
