export const COLLECTION_SEGMENTS = [
  { id: 'presentacion', nombre: 'Presentación / contexto', color: '#2563EB', criterio: 'Saludo, presentación del agente, confirmación de titularidad y preguntas requeridas por el playbook.', salida: 'Titularidad y contexto confirmados; continuar con el mensaje permitido por el playbook.' },
  { id: 'mensaje', nombre: 'Mensaje de deuda', color: '#0891B2', criterio: 'Informar la deuda y preguntar cuándo pretende realizar el pago, según el playbook.', salida: 'La respuesta o intención de pago permite iniciar la negociación.' },
  { id: 'negociacion', nombre: 'Negociación', color: '#EA580C', criterio: 'Documentar las alternativas, condiciones y decisiones de negociación autorizadas por el cliente y su playbook.', salida: 'Se obtiene un acuerdo, no acuerdo o interrupción que debe registrarse.' },
  { id: 'registro', nombre: 'Registro / resolución', color: '#9333EA', criterio: 'Comunicar la resolución cuando sea posible y registrar el resultado y la tipificación de la gestión, con o sin consenso.', salida: 'Registro consistente con la respuesta del cliente; habilitar cierre o documentar interrupción.' },
  { id: 'cierre', nombre: 'Cierre', color: '#16A34A', criterio: 'Dar el cierre y las preguntas adicionales exigidas por el playbook, en coherencia con el registro.', salida: 'Gestión finalizada; si el cliente cortó la interacción, justificar la imposibilidad de cierre verbal.' },
];
export const segmentFor = (node, segments = []) => segments?.find(s => s.id === (node?.data?.metadata || node?.metadata)?.segmentId);
export function qualitySummary(nodes, segments = []) {
  const activities = nodes.filter(n => (n.data?.metadata || n.metadata)?.kind !== 'annotation');
  const results = segments.map(s => {
    const group = activities.filter(n => segmentFor(n, segments)?.id === s.id);
    const exempt = group.filter(n => { const q = (n.data?.metadata || n.metadata)?.calidad; return q?.estado === 'no_aplica' && String(q.justificacion || '').trim(); }).length;
    const compliant = group.filter(n => (n.data?.metadata || n.metadata)?.calidad?.estado === 'cumple').length;
    const applicable = group.length - exempt;
    return { ...s, total: group.length, exempt, compliant, applicable, percent: applicable ? Math.floor(compliant / applicable * 100) : null, complete: group.length > 0 && !!s.criterio.trim() && !!s.salida.trim() && compliant + exempt === group.length };
  });
  const unassigned = activities.filter(n => !segmentFor(n, segments)).length;
  const applicable = results.reduce((sum, s) => sum + s.applicable, 0) + unassigned;
  const compliant = results.reduce((sum, s) => sum + s.compliant, 0);
  const complete = !!results.length && !unassigned && results.every(s => s.complete);
  return { results, unassigned, percent: applicable ? Math.floor(compliant / applicable * 100) : null, complete };
}
export function withSegments(nodes, edges, segments = []) {
  const decorated = nodes.map(n => ({ ...n, data: { ...n.data, segment: segmentFor(n, segments) } }));
  const byId = new Map(decorated.map(n => [n.id, n.data.segment]));
  return { nodes: decorated, edges: edges.map(e => {
    const from = byId.get(e.source), to = byId.get(e.target);
    const transition = from && to && from.id !== to.id;
    return transition ? { ...e, data: { ...e.data, transition: { desde: from.nombre, hasta: to.nombre, criterio: from.salida } }, style: { ...e.style, stroke: to.color, strokeWidth: 2.5 }, markerEnd: { ...e.markerEnd, color: to.color } } : e;
  }) };
}
