import { qualitySummary, COLLECTION_SEGMENTS } from '../workflow/segments';
export function SegmentLegend({ segmentos = [] }) {
  return segmentos.length > 0 && <div className="segment-legend" aria-label="Segmentos del flujo">{segmentos.map(s => <span key={s.id} title={s.criterio}><i style={{ background: s.color }} />{s.nombre}</span>)}</div>;
}
export function QualitySummary({ nodes, segmentos = [] }) {
  if (!segmentos.length) return null;
  const summary = qualitySummary(nodes, segmentos);
  return <details className="quality-summary"><summary>Matriz de calidad documental · {summary.percent === null ? 'Sin criterios aplicables' : summary.percent + '%'} · {summary.complete ? 'Revisión completa' : 'Revisión pendiente'}</summary><p>Revisión manual del playbook. No mide la ejecución real del agente. {summary.unassigned} nodos sin segmento.</p><table><thead><tr><th>Segmento</th><th>Nodos</th><th>Cumplen</th><th>No aplica</th><th>Cumplimiento</th></tr></thead><tbody>{summary.results.map(s => <tr key={s.id}><td>{s.nombre}</td><td>{s.total}</td><td>{s.compliant}</td><td>{s.exempt}</td><td>{s.percent === null ? 'No aplica' : s.percent + '%'} · {s.complete ? 'Completo' : 'Pendiente'}</td></tr>)}</tbody></table></details>;
}
export function SegmentEditor({ segmentos, onChange, nodes, onAssign }) {
  function update(id, patch) { onChange(segmentos.map(s => s.id === id ? { ...s, ...patch } : s)); }
  return <section className="wf-config-section"><h3>Segmentos y criterios</h3><p>Selecciona uno o varios nodos y asígnalos a un segmento.</p><button type="button" onClick={() => onChange([...segmentos, ...structuredClone(COLLECTION_SEGMENTS).filter(s => !segmentos.some(existing => existing.id === s.id))])}>Añadir criterios de cobranza</button><button type="button" onClick={() => onChange([...segmentos, { id: crypto.randomUUID(), nombre: 'Nuevo segmento', color: '#2563EB', criterio: '', salida: '' }])}>+ Segmento</button>
    {segmentos.map(s => <details key={s.id} data-segment-id={s.id}><summary><i className="segment-dot" style={{ background: s.color }} />{s.nombre}</summary><label className="wf-field">Nombre<input value={s.nombre} onChange={e => update(s.id, { nombre: e.target.value })} /></label><label className="wf-field">Color<input type="color" value={s.color} onChange={e => update(s.id, { color: e.target.value })} /></label><label className="wf-field">Criterio del playbook<textarea value={s.criterio} onChange={e => update(s.id, { criterio: e.target.value })} /></label><label className="wf-field">Condición para pasar al siguiente grupo<textarea value={s.salida} onChange={e => update(s.id, { salida: e.target.value })} /></label><button type="button" onClick={() => onAssign(s.id)}>Asignar a selección</button><button type="button" disabled={nodes.some(n => n.data.metadata?.segmentId === s.id)} onClick={() => onChange(segmentos.filter(item => item.id !== s.id))}>Eliminar segmento vacío</button></details>)}
  </section>;
}
